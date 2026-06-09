# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Sportsbook — peer-to-pool sports betting resolved by AI consensus.

Anyone can list a market (a real-world sporting event with a public results page).
Users place stake-weighted bets on one of three outcomes (HOME / DRAW / AWAY).
On resolve, the contract fetches the results page, asks an LLM to extract the
winner, and pays the winning pool proportionally. Validators independently
reproduce the fetch + extraction and reach consensus on the winner.
"""

from genlayer import *

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import typing


# Outcome encoding — kept as small ints so storage stays compact.
OUTCOME_HOME = u8(0)
OUTCOME_DRAW = u8(1)
OUTCOME_AWAY = u8(2)
OUTCOME_UNRESOLVED = u8(255)


@allow_storage
@dataclass
class Bet:
    bettor: Address
    market_id: u256
    outcome: u8
    stake: u256
    claimed: bool


@allow_storage
@dataclass
class Market:
    market_id: u256
    home: str
    away: str
    league: str
    resolution_url: str
    kickoff_unix: u256
    created_by: Address
    pool_home: u256
    pool_draw: u256
    pool_away: u256
    winner: u8
    score: str
    resolved: bool


class Sportsbook(gl.Contract):
    next_market_id: u256
    markets: TreeMap[u256, Market]
    bets: TreeMap[u256, Bet]
    next_bet_id: u256
    bets_by_user: TreeMap[Address, DynArray[u256]]

    def __init__(self):
        self.next_market_id = u256(1)
        self.next_bet_id = u256(1)

    # ─────────────────────────── market management ──────────────────────────

    @gl.public.write
    def create_market(
        self,
        home: str,
        away: str,
        league: str,
        resolution_url: str,
        kickoff_unix: int,
    ) -> int:
        market_id = self.next_market_id
        self.markets[market_id] = Market(
            market_id=market_id,
            home=home,
            away=away,
            league=league,
            resolution_url=resolution_url,
            kickoff_unix=u256(kickoff_unix),
            created_by=gl.message.sender_address,
            pool_home=u256(0),
            pool_draw=u256(0),
            pool_away=u256(0),
            winner=OUTCOME_UNRESOLVED,
            score="",
            resolved=False,
        )
        self.next_market_id = u256(int(self.next_market_id) + 1)
        return int(market_id)

    # ────────────────────────────── betting ─────────────────────────────────

    @gl.public.write.payable
    def place_bet(self, market_id: int, outcome: int) -> int:
        mid = u256(market_id)
        if mid not in self.markets:
            raise gl.vm.UserError("unknown market")

        market = self.markets[mid]
        if market.resolved:
            raise gl.vm.UserError("market already resolved")

        now = int(datetime.now(timezone.utc).timestamp())
        if now >= int(market.kickoff_unix):
            raise gl.vm.UserError("market is closed (kickoff passed)")

        stake = gl.message.value
        if stake == u256(0):
            raise gl.vm.UserError("stake must be > 0")

        oc = u8(outcome)
        if oc == OUTCOME_HOME:
            market.pool_home = u256(int(market.pool_home) + int(stake))
        elif oc == OUTCOME_DRAW:
            market.pool_draw = u256(int(market.pool_draw) + int(stake))
        elif oc == OUTCOME_AWAY:
            market.pool_away = u256(int(market.pool_away) + int(stake))
        else:
            raise gl.vm.UserError("invalid outcome")
        self.markets[mid] = market

        bet_id = self.next_bet_id
        self.bets[bet_id] = Bet(
            bettor=gl.message.sender_address,
            market_id=mid,
            outcome=oc,
            stake=stake,
            claimed=False,
        )
        self.bets_by_user.get_or_insert_default(gl.message.sender_address).append(bet_id)
        self.next_bet_id = u256(int(self.next_bet_id) + 1)
        return int(bet_id)

    # ───────────────────────────── resolution ───────────────────────────────

    @gl.public.write
    def resolve(self, market_id: int) -> typing.Any:
        mid = u256(market_id)
        if mid not in self.markets:
            raise gl.vm.UserError("unknown market")

        market = self.markets[mid]
        if market.resolved:
            return {"already_resolved": True, "winner": int(market.winner), "score": market.score}

        home = market.home
        away = market.away
        url = market.resolution_url

        def nondet() -> str:
            response = gl.nondet.web.get(url)
            web_data = response.body.decode("utf-8")
            # Keep the prompt tight so it generalises across BBC/ESPN/etc.
            task = f"""Read the web page and decide the final result of the
match between HOME team "{home}" and AWAY team "{away}".

Web page content:
{web_data}
End of web page content.

Respond with ONLY this JSON, no prose, no markdown fences:
{{
  "winner": int,    // 0 = HOME win, 1 = DRAW, 2 = AWAY win, -1 = not finished
  "score": str      // e.g. "2:1" or "-" if not finished
}}
"""
            # response_format="json" returns a dict directly — no .replace / json.loads.
            parsed = gl.nondet.exec_prompt(task, response_format="json")
            # Sort keys for stable string comparison across validators.
            return json.dumps(
                {"winner": int(parsed["winner"]), "score": str(parsed["score"])},
                sort_keys=True,
            )

        decision = json.loads(gl.eq_principle.strict_eq(nondet))
        if decision["winner"] < 0:
            return {"resolved": False, "reason": "not finished yet"}

        market.winner = u8(decision["winner"])
        market.score = decision["score"]
        market.resolved = True
        self.markets[mid] = market
        return {"resolved": True, "winner": int(market.winner), "score": market.score}

    # ─────────────────────────────── claims ─────────────────────────────────

    @gl.public.write
    def claim(self, bet_id: int) -> int:
        bid = u256(bet_id)
        if bid not in self.bets:
            raise gl.vm.UserError("unknown bet")
        bet = self.bets[bid]
        if bet.claimed:
            raise gl.vm.UserError("already claimed")
        if bet.bettor != gl.message.sender_address:
            raise gl.vm.UserError("not your bet")

        market = self.markets[bet.market_id]
        if not market.resolved:
            raise gl.vm.UserError("market not resolved")

        if bet.outcome != market.winner:
            # Losing bet: mark claimed so the UI can stop offering it.
            bet.claimed = True
            self.bets[bid] = bet
            return 0

        winning_pool = self._pool_for(market, market.winner)
        total_pool = (
            int(market.pool_home) + int(market.pool_draw) + int(market.pool_away)
        )
        # Pari-mutuel payout: stake * total_pool / winning_pool
        payout = (int(bet.stake) * total_pool) // int(winning_pool)

        bet.claimed = True
        self.bets[bid] = bet

        _send_gen(bet.bettor, u256(payout))
        return payout

    # ───────────────────────────────── views ────────────────────────────────

    @gl.public.view
    def get_market(self, market_id: int) -> dict:
        mid = u256(market_id)
        if mid not in self.markets:
            return {}
        m = self.markets[mid]
        return {
            "market_id": int(m.market_id),
            "home": m.home,
            "away": m.away,
            "league": m.league,
            "resolution_url": m.resolution_url,
            "kickoff_unix": int(m.kickoff_unix),
            "pool_home": str(int(m.pool_home)),
            "pool_draw": str(int(m.pool_draw)),
            "pool_away": str(int(m.pool_away)),
            "winner": int(m.winner),
            "score": m.score,
            "resolved": m.resolved,
        }

    @gl.public.view
    def list_markets(self) -> list:
        out: list = []
        for mid in self.markets:
            out.append(self.get_market(int(mid)))
        return out

    @gl.public.view
    def get_bet(self, bet_id: int) -> dict:
        bid = u256(bet_id)
        if bid not in self.bets:
            return {}
        b = self.bets[bid]
        return {
            "bet_id": int(bid),
            "bettor": b.bettor.as_hex,
            "market_id": int(b.market_id),
            "outcome": int(b.outcome),
            "stake": str(int(b.stake)),
            "claimed": b.claimed,
        }

    @gl.public.view
    def my_bets(self, user: Address) -> list:
        out: list = []
        if user not in self.bets_by_user:
            return out
        for bid in self.bets_by_user[user]:
            out.append(self.get_bet(int(bid)))
        return out

    # ───────────────────────────── internals ────────────────────────────────

    def _pool_for(self, market: Market, outcome: u8) -> u256:
        if outcome == OUTCOME_HOME:
            return market.pool_home
        if outcome == OUTCOME_DRAW:
            return market.pool_draw
        return market.pool_away


@gl.evm.contract_interface
class _Payee:
    class View:
        pass

    class Write:
        pass


def _send_gen(to: Address, value: u256) -> None:
    if value == u256(0):
        return
    _Payee(to).emit_transfer(value=value)
