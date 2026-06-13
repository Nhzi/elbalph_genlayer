# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Casino — instant provably-fair games.

Every game uses a seeded RNG so all validators agree on the outcome without
trusting the leader. The seed mixes the transaction timestamp, the sender,
a per-game counter, and the GenVM's stdin random bytes (per the GenLayer
"Random" docs page).

Bankroll is held by the contract itself (`self.balance`). Anyone can top it
up via `fund_house`; the deployer can withdraw the surplus via `withdraw`.
"""

from genlayer import *

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import typing


# Game IDs (kept as small ints so storage is compact and ABIs stay simple)
GAME_COINFLIP = u8(1)
GAME_DICE = u8(2)
GAME_ROULETTE = u8(3)
GAME_SLOTS = u8(4)

# Slots reel symbols.
SLOT_SYMBOLS = ["7", "BAR", "BELL", "CHERRY", "LEMON", "PLUM"]


@allow_storage
@dataclass
class Round:
    round_id: u256
    bettor: Address
    game: u8
    stake: u256
    payout: u256
    seed_hex: str
    detail: str  # JSON blob: per-game roll/spin data + win flag
    ts_unix: u256


class Casino(gl.Contract):
    owner: Address
    next_round_id: u256
    rounds: TreeMap[u256, Round]
    rounds_by_user: TreeMap[Address, DynArray[u256]]
    recent_rounds: DynArray[u256]
    nonce: u256  # mixed into every seed so the same block can yield many outcomes
    bankroll: u256  # explicit house pool — `self.balance` is only credited
                    # on live networks (ghost contract). Tracking it ourselves
                    # keeps direct-mode tests and on-chain behaviour identical.
    elf_token: Address  # address of the ELF ERC20-like token used for gasless bets

    def __init__(self):
        self.owner = gl.message.sender_address
        self.next_round_id = u256(1)
        self.nonce = u256(0)
        self.bankroll = u256(0)
        self.elf_token = Address(b"\x00" * 20)

    # ─────────────────────────── elf token wiring ───────────────────────────

    @gl.public.write
    def set_elf_token(self, addr: Address) -> bool:
        """Owner sets the ELF token contract this casino settles bets against."""
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("only owner can set elf token")
        self.elf_token = addr
        return True

    @gl.public.view
    def get_elf_token(self) -> str:
        return self.elf_token.as_hex

    # ─────────────────────────── bankroll management ────────────────────────

    @gl.public.write.payable
    def fund_house(self) -> int:
        self.bankroll = u256(int(self.bankroll) + int(gl.message.value))
        return int(gl.message.value)

    @gl.public.write
    def withdraw(self, amount: int) -> int:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("only owner can withdraw")
        if amount > int(self.bankroll):
            raise gl.vm.UserError("insufficient bankroll")
        self.bankroll = u256(int(self.bankroll) - amount)
        _send_gen(self.owner, u256(amount))
        return amount

    @gl.public.view
    def house_balance(self) -> str:
        return str(int(self.bankroll))

    # ───────────────────────────────── coinflip ─────────────────────────────

    @gl.public.write.payable
    def play_coinflip(self, call_heads: bool) -> dict:
        """1.95× payout on win; tiny house edge funds the bankroll."""
        stake = self._require_stake_with_house_coverage(payout_multiplier_numer=195, denom=100)
        seed = self._next_seed()
        outcome_bit = seed[0] & 1  # 0 = tails, 1 = heads
        won = (outcome_bit == 1) == call_heads
        payout = (int(stake) * 195) // 100 if won else 0

        detail = json.dumps(
            {"called": "heads" if call_heads else "tails",
             "landed": "heads" if outcome_bit == 1 else "tails",
             "won": won},
            sort_keys=True,
        )
        result = self._record_round(GAME_COINFLIP, stake, u256(payout), seed.hex(), detail)
        if payout > 0:
            _send_gen(gl.message.sender_address, u256(payout))
        return result

    # ──────────────────────────────────── dice ──────────────────────────────

    @gl.public.write.payable
    def play_dice(self, target_under: int) -> dict:
        """Roll 1–100. Win if roll <= target_under. Payout = stake * 98 / target_under."""
        if target_under < 2 or target_under > 95:
            raise gl.vm.UserError("target_under must be in [2, 95]")
        # Maximum theoretical payout multiplier — used to size the required bankroll.
        max_mult_numer = 98
        stake = self._require_stake_with_house_coverage(
            payout_multiplier_numer=max_mult_numer * 100 // target_under, denom=100
        )
        seed = self._next_seed()
        roll = (int.from_bytes(seed[:8], "big") % 100) + 1
        won = roll <= target_under
        payout = (int(stake) * 98) // target_under if won else 0

        detail = json.dumps(
            {"target_under": target_under, "roll": roll, "won": won},
            sort_keys=True,
        )
        result = self._record_round(GAME_DICE, stake, u256(payout), seed.hex(), detail)
        if payout > 0:
            _send_gen(gl.message.sender_address, u256(payout))
        return result

    # ──────────────────────────────── roulette ──────────────────────────────

    @gl.public.write.payable
    def play_roulette(self, bet_type: str, bet_value: int) -> dict:
        """
        European single-zero roulette (0–36). bet_type ∈ {"number","red","black","even","odd","low","high"}.
        Payouts: number 35×, others 2× (1:1 + stake).
        """
        valid_types = {"number", "red", "black", "even", "odd", "low", "high"}
        if bet_type not in valid_types:
            raise gl.vm.UserError("unknown bet_type")
        if bet_type == "number" and (bet_value < 0 or bet_value > 36):
            raise gl.vm.UserError("number must be 0..36")

        # Worst-case payout multiplier
        max_mult_numer = 36 if bet_type == "number" else 2
        stake = self._require_stake_with_house_coverage(
            payout_multiplier_numer=max_mult_numer, denom=1
        )

        seed = self._next_seed()
        spin = int.from_bytes(seed[:8], "big") % 37  # 0..36

        red_numbers = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
        won = False
        if bet_type == "number":
            won = spin == bet_value
            multiplier = 36 if won else 0
        else:
            if spin == 0:
                won = False
            elif bet_type == "red":
                won = spin in red_numbers
            elif bet_type == "black":
                won = spin not in red_numbers
            elif bet_type == "even":
                won = spin % 2 == 0
            elif bet_type == "odd":
                won = spin % 2 == 1
            elif bet_type == "low":
                won = 1 <= spin <= 18
            elif bet_type == "high":
                won = 19 <= spin <= 36
            multiplier = 2 if won else 0

        payout = int(stake) * multiplier
        detail = json.dumps(
            {"bet_type": bet_type, "bet_value": bet_value, "spin": spin,
             "color": ("green" if spin == 0 else "red" if spin in red_numbers else "black"),
             "won": won},
            sort_keys=True,
        )
        result = self._record_round(GAME_ROULETTE, stake, u256(payout), seed.hex(), detail)
        if payout > 0:
            _send_gen(gl.message.sender_address, u256(payout))
        return result

    # ───────────────────────────────── slots ────────────────────────────────

    @gl.public.write.payable
    def play_slots(self) -> dict:
        """3-reel slots. Payouts:
        - 3× 7   → 50×
        - 3× BAR → 20×
        - 3× BELL/CHERRY/LEMON/PLUM → 10×
        - 2× 7   → 5×
        - any pair → 2×
        """
        stake = self._require_stake_with_house_coverage(payout_multiplier_numer=50, denom=1)
        seed = self._next_seed()
        reels = [
            SLOT_SYMBOLS[seed[0] % len(SLOT_SYMBOLS)],
            SLOT_SYMBOLS[seed[1] % len(SLOT_SYMBOLS)],
            SLOT_SYMBOLS[seed[2] % len(SLOT_SYMBOLS)],
        ]
        multiplier = 0
        if reels[0] == reels[1] == reels[2]:
            multiplier = 50 if reels[0] == "7" else 20 if reels[0] == "BAR" else 10
        elif reels.count("7") == 2:
            multiplier = 5
        elif len(set(reels)) == 2:
            multiplier = 2

        payout = int(stake) * multiplier
        detail = json.dumps({"reels": reels, "won": multiplier > 0, "multiplier": multiplier}, sort_keys=True)
        result = self._record_round(GAME_SLOTS, stake, u256(payout), seed.hex(), detail)
        if payout > 0:
            _send_gen(gl.message.sender_address, u256(payout))
        return result

    # ─────────────────────── gasless ELF play paths ─────────────────────────
    #
    # Mirror the .payable game methods but settle bets in ELF rather than
    # native GEN. The casino must be a minter on the ELF token. The user
    # never sends value; we burn their stake and mint payout on a win.

    @gl.public.write
    def play_coinflip_elf(self, call_heads: bool, stake: int) -> dict:
        s = self._elf_take_stake(stake, 195, 100)
        seed = self._next_seed()
        outcome_bit = seed[0] & 1
        won = (outcome_bit == 1) == call_heads
        payout = (s * 195) // 100 if won else 0
        detail = json.dumps(
            {"called": "heads" if call_heads else "tails",
             "landed": "heads" if outcome_bit == 1 else "tails",
             "won": won},
            sort_keys=True,
        )
        result = self._record_round(GAME_COINFLIP, u256(s), u256(payout), seed.hex(), detail)
        if payout > 0:
            _mint_elf(self.elf_token, gl.message.sender_address, payout)
        return result

    @gl.public.write
    def play_dice_elf(self, target_under: int, stake: int) -> dict:
        if target_under < 2 or target_under > 95:
            raise gl.vm.UserError("target_under must be in [2, 95]")
        s = self._elf_take_stake(stake, 98 * 100 // target_under, 100)
        seed = self._next_seed()
        roll = (int.from_bytes(seed[:8], "big") % 100) + 1
        won = roll <= target_under
        payout = (s * 98) // target_under if won else 0
        detail = json.dumps(
            {"target_under": target_under, "roll": roll, "won": won},
            sort_keys=True,
        )
        result = self._record_round(GAME_DICE, u256(s), u256(payout), seed.hex(), detail)
        if payout > 0:
            _mint_elf(self.elf_token, gl.message.sender_address, payout)
        return result

    @gl.public.write
    def play_roulette_elf(self, bet_type: str, bet_value: int, stake: int) -> dict:
        valid_types = {"number", "red", "black", "even", "odd", "low", "high"}
        if bet_type not in valid_types:
            raise gl.vm.UserError("unknown bet_type")
        if bet_type == "number" and (bet_value < 0 or bet_value > 36):
            raise gl.vm.UserError("number must be 0..36")
        max_mult_numer = 36 if bet_type == "number" else 2
        s = self._elf_take_stake(stake, max_mult_numer, 1)
        seed = self._next_seed()
        spin = int.from_bytes(seed[:8], "big") % 37
        red_numbers = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
        won = False
        if bet_type == "number":
            won = spin == bet_value
            multiplier = 36 if won else 0
        else:
            if spin == 0:
                won = False
            elif bet_type == "red":
                won = spin in red_numbers
            elif bet_type == "black":
                won = spin not in red_numbers
            elif bet_type == "even":
                won = spin % 2 == 0
            elif bet_type == "odd":
                won = spin % 2 == 1
            elif bet_type == "low":
                won = 1 <= spin <= 18
            elif bet_type == "high":
                won = 19 <= spin <= 36
            multiplier = 2 if won else 0
        payout = s * multiplier
        detail = json.dumps(
            {"bet_type": bet_type, "bet_value": bet_value, "spin": spin,
             "color": ("green" if spin == 0 else "red" if spin in red_numbers else "black"),
             "won": won},
            sort_keys=True,
        )
        result = self._record_round(GAME_ROULETTE, u256(s), u256(payout), seed.hex(), detail)
        if payout > 0:
            _mint_elf(self.elf_token, gl.message.sender_address, payout)
        return result

    @gl.public.write
    def play_slots_elf(self, stake: int) -> dict:
        s = self._elf_take_stake(stake, 50, 1)
        seed = self._next_seed()
        reels = [
            SLOT_SYMBOLS[seed[0] % len(SLOT_SYMBOLS)],
            SLOT_SYMBOLS[seed[1] % len(SLOT_SYMBOLS)],
            SLOT_SYMBOLS[seed[2] % len(SLOT_SYMBOLS)],
        ]
        multiplier = 0
        if reels[0] == reels[1] == reels[2]:
            multiplier = 50 if reels[0] == "7" else 20 if reels[0] == "BAR" else 10
        elif reels.count("7") == 2:
            multiplier = 5
        elif len(set(reels)) == 2:
            multiplier = 2
        payout = s * multiplier
        detail = json.dumps({"reels": reels, "won": multiplier > 0, "multiplier": multiplier}, sort_keys=True)
        result = self._record_round(GAME_SLOTS, u256(s), u256(payout), seed.hex(), detail)
        if payout > 0:
            _mint_elf(self.elf_token, gl.message.sender_address, payout)
        return result

    # ───────────────────────────────── views ────────────────────────────────

    @gl.public.view
    def get_round(self, round_id: int) -> dict:
        rid = u256(round_id)
        if rid not in self.rounds:
            return {}
        r = self.rounds[rid]
        return {
            "round_id": int(r.round_id),
            "bettor": r.bettor.as_hex,
            "game": int(r.game),
            "stake": str(int(r.stake)),
            "payout": str(int(r.payout)),
            "seed_hex": r.seed_hex,
            "detail": json.loads(r.detail),
            "ts_unix": int(r.ts_unix),
        }

    @gl.public.view
    def recent(self, limit: int = 20) -> list:
        out: list = []
        n = len(self.recent_rounds)
        start = max(0, n - limit)
        for i in range(start, n):
            out.append(self.get_round(int(self.recent_rounds[i])))
        return list(reversed(out))

    @gl.public.view
    def my_rounds(self, user: Address) -> list:
        out: list = []
        if user not in self.rounds_by_user:
            return out
        for rid in self.rounds_by_user[user]:
            out.append(self.get_round(int(rid)))
        return list(reversed(out))

    # ───────────────────────────── internals ────────────────────────────────

    def _next_seed(self) -> bytes:
        """Deterministic-across-validators seed.

        Mixes the transaction datetime, sender, contract address, and a
        per-call monotonic nonce. All four are identical for every validator
        re-executing the same transaction, so the SHA-256 digest agrees
        across the network without trusting the leader.
        """
        self.nonce = u256(int(self.nonce) + 1)
        h = hashlib.sha256()
        h.update(gl.message_raw["datetime"].encode("utf-8"))
        h.update(bytes.fromhex(gl.message.sender_address.as_hex[2:]))
        h.update(bytes.fromhex(gl.message.contract_address.as_hex[2:]))
        h.update(int(self.nonce).to_bytes(32, "big"))
        return h.digest()

    def _require_stake_with_house_coverage(
        self, payout_multiplier_numer: int, denom: int
    ) -> u256:
        stake = gl.message.value
        if stake == u256(0):
            raise gl.vm.UserError("stake must be > 0")
        max_payout = (int(stake) * payout_multiplier_numer) // max(denom, 1)
        if int(self.bankroll) < max_payout:
            raise gl.vm.UserError("house bankroll too small for this stake")
        # Bankroll fronts the max possible payout. On a loss we'll add the
        # stake to the bankroll in `_record_round`; on a win we subtract the
        # payout there.
        return stake

    def _elf_take_stake(self, stake: int, payout_multiplier_numer: int, denom: int) -> int:
        """Burn ELF from sender + verify bankroll covers worst-case payout."""
        if stake <= 0:
            raise gl.vm.UserError("stake must be > 0")
        if self.elf_token == Address(b"\x00" * 20):
            raise gl.vm.UserError("elf token not configured")
        max_payout = (stake * payout_multiplier_numer) // max(denom, 1)
        if int(self.bankroll) < max_payout:
            raise gl.vm.UserError("house bankroll too small for this stake")
        _burn_elf(self.elf_token, gl.message.sender_address, stake)
        return stake

    def _record_round(
        self,
        game: u8,
        stake: u256,
        payout: u256,
        seed_hex: str,
        detail: str,
    ) -> dict:
        rid = self.next_round_id
        ts = u256(int(datetime.now(timezone.utc).timestamp()))
        r = Round(
            round_id=rid,
            bettor=gl.message.sender_address,
            game=game,
            stake=stake,
            payout=payout,
            seed_hex=seed_hex,
            detail=detail,
            ts_unix=ts,
        )
        self.rounds[rid] = r
        self.rounds_by_user.get_or_insert_default(gl.message.sender_address).append(rid)
        self.recent_rounds.append(rid)
        self.next_round_id = u256(int(rid) + 1)

        # Update bankroll: house keeps (stake - payout). Negative => player won.
        net = int(stake) - int(payout)
        if net >= 0:
            self.bankroll = u256(int(self.bankroll) + net)
        else:
            self.bankroll = u256(int(self.bankroll) - (-net))
        return {
            "round_id": int(rid),
            "stake": str(int(stake)),
            "payout": str(int(payout)),
            "won": int(payout) > 0,
            "seed_hex": seed_hex,
            "detail": json.loads(detail),
        }


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


# ─────────────────────── ELF token cross-contract calls ────────────────────
#
# The casino burns user stake on bet placement and mints payout on win. It
# must already be authorized as a minter on the ELF token contract — the
# deploy script does that registration.
#
# Note: inter-contract writes via `.emit()` are *deferred* — they enqueue a
# message that runs after the current call. That's fine for the burn/mint
# settlement pair, since the seed-driven outcome is deterministic before
# either side-effect lands.


def _burn_elf(token: Address, from_addr: Address, amount: int) -> None:
    if amount <= 0:
        return
    gl.get_contract_at(token).emit().burn(from_addr, amount)


def _mint_elf(token: Address, to: Address, amount: int) -> None:
    if amount <= 0:
        return
    gl.get_contract_at(token).emit().mint(to, amount)
