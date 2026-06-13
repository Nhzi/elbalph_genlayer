'use client';

import Link from 'next/link';
import { fmtGen } from '@/lib/genlayer';
import type { CasinoRound, SportsMarket } from '@/lib/contracts';

type Props = {
  house: string;
  totalSportsPool: bigint;
  rounds: CasinoRound[];
  markets: SportsMarket[];
};

const GAME_NAMES: Record<number, string> = { 1: 'Coinflip', 2: 'Dice', 3: 'Roulette', 4: 'Slots' };

const GAMES = [
  { href: '/casino/coinflip', name: 'Coinflip', tag: '1.95×', emoji: '🪙' },
  { href: '/casino/dice', name: 'Dice', tag: 'up to 49×', emoji: '🎲' },
  { href: '/casino/roulette', name: 'Roulette', tag: '35×', emoji: '🎡' },
  { href: '/casino/slots', name: 'Slots', tag: '50×', emoji: '🎰' },
];

/**
 * Mobile-only landing page. Tight, stacked layout — no 3D hero canvas, no wide
 * tickers. Tap targets are big, copy is short, and the FAUCET CTA leads.
 */
export function MobileLanding({ house, totalSportsPool, rounds, markets }: Props) {
  return (
    <div className="space-y-6 pb-12 pt-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-neon-gold/10 via-black/20 to-transparent p-5">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-neon-gold/20 blur-3xl" />
        <div className="pill mb-3 inline-flex items-center gap-2 text-white/70">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-green opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-green" />
          </span>
          Live on GenLayer
        </div>
        <h1 className="font-display text-3xl font-black leading-tight">
          AI-judged bets,
          <br />
          paid in{' '}
          <span className="bg-gradient-to-r from-neon-gold via-neon-pink to-neon-cyan bg-clip-text text-transparent">
            ELF
          </span>
          .
        </h1>
        <p className="mt-3 text-sm text-white/65">
          Sports markets settled by validators reading the score page themselves. Casino games
          paid in a single transaction. Use the faucet to grab 100,000 ELF — bets are gasless.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link href="/sports" className="btn-primary w-full text-center text-base">
            Open the sportsbook →
          </Link>
          <Link href="/casino" className="btn-secondary w-full text-center text-base">
            Enter the casino
          </Link>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-3 gap-2">
        <StatCard label="Bankroll" value={`${fmtGen(house, 1)}`} suffix="ELF" accent="text-neon-gold" />
        <StatCard
          label="Sports pool"
          value={`${fmtGen(totalSportsPool, 1)}`}
          suffix="ELF"
          accent="text-neon-cyan"
        />
        <StatCard
          label="Rounds"
          value={rounds.length ? `${rounds[0].round_id}+` : '—'}
          suffix=""
          accent="text-neon-pink"
        />
      </section>

      {/* Games */}
      <section>
        <h2 className="mb-2 font-display text-lg font-bold">Pick a game</h2>
        <div className="grid grid-cols-2 gap-2">
          {GAMES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="chip flex items-center justify-between gap-2 p-4 active:scale-[0.98]"
            >
              <div>
                <div className="text-2xl">{g.emoji}</div>
                <div className="mt-1 font-display text-base font-bold">{g.name}</div>
              </div>
              <div className="pill text-[10px] text-white/70">{g.tag}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent rounds — mobile vertical list */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Live rounds</h2>
          <span className="text-[10px] uppercase tracking-widest text-white/40">every 6s</span>
        </div>
        <div className="space-y-2">
          {rounds.length === 0 ? (
            <div className="chip p-4 text-center text-sm text-white/40">
              No rounds yet — be the first.
            </div>
          ) : (
            rounds.slice(0, 5).map((r) => {
              const won = BigInt(r.payout) > 0n;
              return (
                <div
                  key={r.round_id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2.5"
                >
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40">
                      #{r.round_id} · {GAME_NAMES[r.game] ?? `Game ${r.game}`}
                    </div>
                    <div className="font-mono text-xs text-white/70">
                      {r.bettor.slice(0, 6)}…{r.bettor.slice(-4)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/50">{fmtGen(r.stake, 2)} ELF</div>
                    <div
                      className={`font-mono text-sm font-semibold ${
                        won ? 'text-neon-green' : 'text-white/50'
                      }`}
                    >
                      {won ? `+${fmtGen(r.payout, 2)}` : 'loss'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Sports markets quick peek */}
      {markets.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold">Open markets</h2>
          <div className="space-y-2">
            {markets.slice(0, 3).map((m) => (
              <Link
                key={m.market_id}
                href="/sports"
                className="block rounded-xl border border-white/5 bg-black/30 px-3 py-2.5"
              >
                <div className="text-[10px] uppercase tracking-widest text-neon-cyan/80">
                  {m.league}
                </div>
                <div className="mt-0.5 text-sm font-semibold text-white">
                  {m.home} <span className="text-white/40">vs</span> {m.away}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* How it works — compact */}
      <section className="chip space-y-3 p-4">
        <div className="pill text-white/60">Under the hood</div>
        <h2 className="font-display text-xl font-bold">No oracles. No admin keys.</h2>
        <p className="text-sm text-white/65">
          Validators each fetch the result page and ask an LLM for the winner. Casino rounds use
          a SHA-256 seed that every validator reproduces — so the outcome is consensus, not the
          leader&apos;s choice.
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
      <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${accent}`}>
        {value}
        {suffix && <span className="ml-0.5 text-[10px] text-white/40">{suffix}</span>}
      </div>
    </div>
  );
}
