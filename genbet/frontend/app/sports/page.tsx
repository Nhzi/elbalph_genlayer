'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listMarkets,
  placeSportsBet,
  resolveMarket,
  claimSportsBet,
  myBets,
  SportsMarket,
  SportsBet,
} from '@/lib/contracts';
import { gen, fmtGen } from '@/lib/genlayer';
import { useStore } from '@/lib/store';
import { BetSlip } from '@/components/BetSlip';

const OUTCOMES = ['HOME', 'DRAW', 'AWAY'] as const;

export default function SportsPage() {
  const [markets, setMarkets] = useState<SportsMarket[]>([]);
  const [bets, setBets] = useState<SportsBet[]>([]);
  const [selectedMid, setSelectedMid] = useState<number | null>(null);
  const [picked, setPicked] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);
  const address = useStore((s) => s.address);

  const refresh = async () => {
    try {
      const m = await listMarkets();
      setMarkets(m);
      if (selectedMid == null && m.length) setSelectedMid(m[0].market_id);
      if (address) setBets(await myBets(address));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const selected = useMemo(
    () => markets.find((m) => m.market_id === selectedMid) ?? null,
    [markets, selectedMid],
  );

  const totalPool = selected
    ? BigInt(selected.pool_home) + BigInt(selected.pool_draw) + BigInt(selected.pool_away)
    : 0n;

  const odds = (outcome: 0 | 1 | 2): string => {
    if (!selected) return '–';
    const pool = [selected.pool_home, selected.pool_draw, selected.pool_away][outcome];
    const p = BigInt(pool);
    if (p === 0n || totalPool === 0n) return '∞';
    // Decimal odds approximated as totalPool / outcomePool
    const ratio = Number(totalPool * 100n / (p === 0n ? 1n : p)) / 100;
    return ratio.toFixed(2);
  };

  return (
    <div className="grid gap-6 pt-6 md:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Sports Markets</h1>
          <button onClick={refresh} className="btn-secondary text-xs">
            Refresh
          </button>
        </div>

        {markets.length === 0 ? (
          <div className="chip p-6 text-center text-white/60">
            No markets yet. Deploy <span className="font-mono">create_market</span> from the deploy
            script or call it from any wallet.
          </div>
        ) : (
          <div className="space-y-2">
            {markets.map((m) => (
              <button
                key={m.market_id}
                onClick={() => setSelectedMid(m.market_id)}
                className={`chip block w-full p-4 text-left transition ${
                  selectedMid === m.market_id ? 'border-neon-green/40 shadow-glow' : ''
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs text-white/40">{m.league}</div>
                    <div className="font-display text-xl">
                      {m.home} <span className="text-white/40">vs</span> {m.away}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-white/40">Pool</div>
                    <div className="font-mono text-sm text-neon-green">
                      {fmtGen(
                        (BigInt(m.pool_home) + BigInt(m.pool_draw) + BigInt(m.pool_away)).toString(),
                      )}{' '}
                      GEN
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {m.resolved ? (
                    <span className="pill bg-neon-green/10 text-neon-green border-neon-green/30">
                      {OUTCOMES[m.winner]} · {m.score}
                    </span>
                  ) : (
                    <>
                      <span className="pill">Kickoff {new Date(m.kickoff_unix * 1000).toLocaleString()}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {bets.length > 0 && (
          <div className="space-y-2 pt-6">
            <h2 className="font-display text-lg font-bold">Your Bets</h2>
            {bets.map((b) => {
              const m = markets.find((x) => x.market_id === b.market_id);
              const canClaim = m?.resolved && !b.claimed;
              return (
                <div key={b.bet_id} className="chip flex items-center justify-between p-3">
                  <div>
                    <div className="font-mono text-xs text-white/40">#{b.bet_id}</div>
                    <div>
                      {m ? `${m.home} vs ${m.away}` : `Market ${b.market_id}`} ·{' '}
                      <span className="text-neon-green">{OUTCOMES[b.outcome]}</span> ·{' '}
                      {fmtGen(b.stake)} GEN
                    </div>
                  </div>
                  {canClaim && (
                    <button
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await claimSportsBet(b.bet_id);
                          refresh();
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                      className="btn-primary text-xs"
                    >
                      Claim
                    </button>
                  )}
                  {b.claimed && <span className="pill">Settled</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <aside className="space-y-3">
        {selected ? (
          <>
            <div className="chip p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/40">Pick</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['HOME', 'DRAW', 'AWAY'] as const).map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setPicked(i as 0 | 1 | 2)}
                    className={`rounded-lg border px-2 py-3 text-center transition ${
                      picked === i
                        ? 'border-neon-green bg-neon-green/10 text-neon-green shadow-glow'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-xs text-white/60">{label}</div>
                    <div className="font-mono text-lg">{odds(i as 0 | 1 | 2)}</div>
                  </button>
                ))}
              </div>
            </div>

            <BetSlip
              cta={`Back ${OUTCOMES[picked]}`}
              currency="GEN"
              disabled={selected.resolved}
              onConfirm={async (amount) => {
                await placeSportsBet(selected.market_id, picked, gen(amount));
                refresh();
              }}
              helper={
                <div className="text-xs text-white/40">
                  Pari-mutuel: winners split the entire pool proportional to stake. Odds shown are
                  current — they shift with each new bet.
                </div>
              }
            />

            {!selected.resolved && selected.kickoff_unix * 1000 < Date.now() && (
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await resolveMarket(selected.market_id);
                    refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="btn-pink w-full"
              >
                {busy ? 'Asking validators…' : 'Resolve via AI consensus'}
              </button>
            )}
          </>
        ) : (
          <div className="chip p-4 text-white/60">Pick a market to place a bet.</div>
        )}
      </aside>
    </div>
  );
}
