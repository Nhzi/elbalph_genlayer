'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  houseBalance,
  recentRounds,
  listMarkets,
  playCoinflip,
  playCoinflipElf,
  CasinoRound,
  SportsMarket,
} from '@/lib/contracts';
import {
  fmtGen,
  gen,
  elf,
  SPORTSBOOK_ADDRESS,
  CASINO_ADDRESS,
  ELF_TOKEN_ADDRESS,
} from '@/lib/genlayer';
import { useStore } from '@/lib/store';
import { MobileLanding } from '@/components/MobileLanding';

const CoinFlip3D = dynamic(
  () => import('@/components/three/CoinFlip3D').then((m) => m.CoinFlip3D),
  { ssr: false, loading: () => <div className="h-[320px] w-full rounded-xl bg-black/30" /> },
);

const GAME_NAMES: Record<number, string> = { 1: 'Coinflip', 2: 'Dice', 3: 'Roulette', 4: 'Slots' };
const OUTCOMES = ['HOME', 'DRAW', 'AWAY'] as const;

export default function Lobby() {
  const address = useStore((s) => s.address);
  const [house, setHouse] = useState<string>('0');
  const [rounds, setRounds] = useState<CasinoRound[]>([]);
  const [markets, setMarkets] = useState<SportsMarket[]>([]);
  const [demoSide, setDemoSide] = useState<'heads' | 'tails'>('heads');
  const [demoResult, setDemoResult] = useState<'heads' | 'tails' | null>(null);
  const [demoSpinning, setDemoSpinning] = useState(false);
  const [demoPayout, setDemoPayout] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const [h, r, m] = await Promise.all([
          houseBalance().catch(() => '0'),
          recentRounds(8).catch(() => [] as CasinoRound[]),
          listMarkets().catch(() => [] as SportsMarket[]),
        ]);
        if (!alive) return;
        setHouse(h);
        setRounds(r);
        setMarkets(m);
      } catch {
        /* RPC not up yet — keep showing zeros */
      }
    };
    refresh();
    const t = setInterval(refresh, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const totalSportsPool = useMemo(
    () =>
      markets.reduce(
        (acc, m) => acc + BigInt(m.pool_home) + BigInt(m.pool_draw) + BigInt(m.pool_away),
        0n,
      ),
    [markets],
  );

  const tryDemoFlip = async () => {
    setDemoError(null);
    setDemoResult(null);
    setDemoPayout(null);
    setDemoSpinning(true);
    try {
      // Prefer the gasless ELF path when the token is configured; fall back to
      // the original GEN-payable path for local dev where ELF may be absent.
      const round = ELF_TOKEN_ADDRESS
        ? await playCoinflipElf(demoSide === 'heads', elf(0.1))
        : await playCoinflip(demoSide === 'heads', gen(0.1));
      const landed = round?.detail?.landed === 'heads' ? 'heads' : 'tails';
      setDemoResult(landed);
      setDemoPayout(round?.payout ?? '0');
    } catch (e: any) {
      setDemoError(e?.shortMessage ?? e?.message ?? 'Transaction failed');
    } finally {
      setDemoSpinning(false);
    }
  };

  return (
    <>
      {/* Mobile-only landing — solely for sub-md screens. */}
      <div className="md:hidden">
        <MobileLanding
          house={house}
          totalSportsPool={totalSportsPool}
          rounds={rounds}
          markets={markets}
        />
      </div>

      <div className="hidden space-y-24 pt-6 md:block">
      {/* ─────────────────────── HERO ─────────────────────── */}
      <section className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="absolute -top-32 left-1/2 -z-10 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-neon-green/10 blur-3xl" />
        <div>
          <div className="pill mb-5 inline-flex items-center gap-2 text-white/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-green opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-green" />
            </span>
            Live on GenLayer · Optimistic Democracy
          </div>
          <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
            The house has{' '}
            <span className="bg-gradient-to-r from-neon-green via-neon-cyan to-neon-pink bg-clip-text text-transparent">
              no edge it can hide.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/65">
            <span className="font-semibold text-white">ELBALPH</span> is a betting house written
            as intelligent contracts. All bets are settled in{' '}
            <span className="font-semibold text-neon-gold">ELF</span>, the in-app token —
            gasless to you, audit-trail for everyone. Sports markets are resolved by validators
            reading the score page themselves; casino games are seeded from on-chain entropy and
            paid in a single transaction. No oracles. No admin keys.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/sports" className="btn-primary text-base">
              Open the sportsbook →
            </Link>
            <Link href="/casino" className="btn-secondary text-base">
              Enter the casino
            </Link>
            <a
              href="#how"
              className="text-sm text-white/50 underline-offset-4 hover:text-white hover:underline"
            >
              how does it work?
            </a>
          </div>

          <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
            <Stat label="House bankroll" value={`${fmtGen(house, 1)} ELF`} accent="text-neon-gold" />
            <Stat
              label="Sports pool"
              value={`${fmtGen(totalSportsPool, 1)} ELF`}
              accent="text-neon-cyan"
            />
            <Stat
              label="Rounds settled"
              value={rounds.length ? `${rounds[0].round_id}+` : '—'}
              accent="text-neon-pink"
            />
          </div>
        </div>

        {/* Hero coin + try-it-now */}
        <div className="chip relative overflow-hidden p-4">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-neon-gold/15 blur-3xl" />
          <CoinFlip3D result={demoResult} spinning={demoSpinning} />
          <div className="mt-4 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              try it · 0.1 ELF
            </div>
            <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
              {(['heads', 'tails'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setDemoSide(s)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    demoSide === s ? 'bg-neon-gold text-black' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={tryDemoFlip}
            disabled={demoSpinning || !CASINO_ADDRESS}
            className="btn-primary mt-3 w-full text-base"
          >
            {demoSpinning ? 'Asking validators…' : `Flip for ${demoSide.toUpperCase()}`}
          </button>
          {demoResult && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-white/60">
                Landed <span className="font-semibold text-neon-gold">{demoResult.toUpperCase()}</span>
              </span>
              <span
                className={
                  demoPayout && demoPayout !== '0' ? 'text-neon-green' : 'text-white/50'
                }
              >
                Payout: {fmtGen(demoPayout ?? '0', 3)} ELF
              </span>
            </div>
          )}
          {demoError && (
            <div className="mt-3 break-words text-xs text-neon-pink">{demoError}</div>
          )}
          {!CASINO_ADDRESS && (
            <div className="mt-3 text-xs text-white/50">
              Set <span className="font-mono">NEXT_PUBLIC_CASINO_ADDRESS</span> in{' '}
              <span className="font-mono">.env.local</span> to enable the demo.
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────── LIVE TICKER ─────────────────────── */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold tracking-wide text-white/80">
            Live rounds
          </h2>
          <span className="text-xs text-white/40">updates every 6s</span>
        </div>
        <div className="chip scroll-soft flex gap-3 overflow-x-auto p-3">
          {rounds.length === 0 ? (
            <div className="px-2 py-4 text-sm text-white/40">
              No rounds yet — be the first to flip a coin or roll the dice.
            </div>
          ) : (
            rounds.map((r) => {
              const won = BigInt(r.payout) > 0n;
              return (
                <div
                  key={r.round_id}
                  className="min-w-[180px] rounded-lg border border-white/5 bg-black/30 p-3"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/40">
                    <span>#{r.round_id}</span>
                    <span>{GAME_NAMES[r.game] ?? `Game ${r.game}`}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-white/70">
                    {r.bettor.slice(0, 6)}…{r.bettor.slice(-4)}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xs text-white/50">{fmtGen(r.stake, 2)} ELF</span>
                    <span
                      className={`font-mono text-sm font-semibold ${
                        won ? 'text-neon-green' : 'text-white/50'
                      }`}
                    >
                      {won ? `+${fmtGen(r.payout, 2)}` : 'loss'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ─────────────────────── TWO PILLARS ─────────────────────── */}
      <section className="grid gap-6 sm:grid-cols-2">
        <Link
          href="/sports"
          className="chip group relative block overflow-hidden transition hover:border-neon-cyan/40"
        >
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-neon-cyan/20 blur-3xl transition group-hover:bg-neon-cyan/30" />
          <div className="relative bg-gradient-to-br from-neon-cyan/10 to-transparent p-7">
            <div className="pill mb-4 border-neon-cyan/30 text-neon-cyan">Sports</div>
            <h2 className="font-display text-3xl font-bold">AI-resolved real-world markets.</h2>
            <p className="mt-3 text-white/65">
              Any URL with a final score can settle a market. Validators each fetch the page,
              ask an LLM to extract the winner under strict equality, and pay out the winning
              pool pari-mutuel. The contract is the bookie.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan" /> Anyone can list a market
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan" /> Pari-mutuel pools — odds
                shift with each bet
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan" /> No oracle, no admin
              </li>
            </ul>
            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="font-mono text-white/50">
                {markets.length} market{markets.length === 1 ? '' : 's'} live
              </span>
              <span className="font-semibold text-neon-cyan">Open sportsbook →</span>
            </div>
          </div>
        </Link>

        <Link
          href="/casino"
          className="chip group relative block overflow-hidden transition hover:border-neon-pink/40"
        >
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-neon-pink/20 blur-3xl transition group-hover:bg-neon-pink/30" />
          <div className="relative bg-gradient-to-br from-neon-pink/10 to-transparent p-7">
            <div className="pill mb-4 border-neon-pink/30 text-neon-pink">Casino</div>
            <h2 className="font-display text-3xl font-bold">Provably-fair instant games.</h2>
            <p className="mt-3 text-white/65">
              Coinflip, dice, roulette, slots. Every round is seeded from the transaction&apos;s
              own datetime, sender, and a per-call nonce — identical for every validator, so
              the outcome is consensus, not luck the leader chose.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-neon-pink" /> Bankroll lives in the
                contract — house can never run dry
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-neon-pink" /> Bet + payout in a single
                tx
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-neon-pink" /> Seed hash exposed on the
                receipt
              </li>
            </ul>
            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="font-mono text-white/50">
                bankroll {fmtGen(house, 1)} ELF
              </span>
              <span className="font-semibold text-neon-pink">Enter casino →</span>
            </div>
          </div>
        </Link>
      </section>

      {/* ─────────────────────── GAMES GRID ─────────────────────── */}
      <section>
        <h2 className="mb-4 font-display text-2xl font-bold">Pick your game.</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/casino/coinflip', name: 'Coinflip', tag: '1.95×', accent: 'from-neon-gold/25', emoji: '🪙' },
            { href: '/casino/dice', name: 'Dice', tag: 'up to 49×', accent: 'from-neon-cyan/25', emoji: '🎲' },
            { href: '/casino/roulette', name: 'Roulette', tag: '35× on number', accent: 'from-neon-pink/25', emoji: '🎡' },
            { href: '/casino/slots', name: 'Slots', tag: '50× on 7-7-7', accent: 'from-neon-green/25', emoji: '🎰' },
          ].map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="chip group block overflow-hidden transition hover:scale-[1.02] hover:shadow-glow"
            >
              <div className={`bg-gradient-to-br ${g.accent} to-transparent p-5`}>
                <div className="flex items-center justify-between">
                  <div className="text-3xl">{g.emoji}</div>
                  <div className="pill text-white/80">{g.tag}</div>
                </div>
                <div className="mt-4 font-display text-xl font-bold">{g.name}</div>
                <div className="mt-1 text-xs text-white/50 transition group-hover:text-white/80">
                  Play →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─────────────────────── HOW IT WORKS ─────────────────────── */}
      <section id="how" className="space-y-6">
        <div>
          <div className="pill mb-3 text-white/60">Under the hood</div>
          <h2 className="font-display text-3xl font-bold">How a market settles itself.</h2>
          <p className="mt-2 max-w-2xl text-white/60">
            ELBALPH never trusts a single party for the outcome. Sports markets reach consensus
            on what the LLM extracts; casino rounds reach consensus on what the seed produces.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Step
            n="01"
            title="Call resolve()"
            body="Anyone can poke the contract once the match is over — the bettors themselves, a scheduled bot, you on a coffee break."
            code="sportsbook.resolve(market_id)"
          />
          <Step
            n="02"
            title="Validators fetch + extract"
            body="Each validator runs gl.nondet.web.get() on the result URL, then asks the LLM for { winner, score } JSON. The call runs under gl.eq_principle.strict_eq."
            code='gl.nondet.exec_prompt(task, response_format="json")'
          />
          <Step
            n="03"
            title="Strict-equality consensus"
            body="Validators agree on sorted-key JSON. If the page isn't final yet, winner = -1 and the market simply stays open — anyone can re-trigger later."
            code='gl.eq_principle.strict_eq(...)'
          />
        </div>
        <div className="chip p-5">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Casino rounds</div>
          <p className="mt-1 text-white/70">
            For the casino the seed is{' '}
            <span className="font-mono text-neon-green">
              SHA256(tx.datetime ‖ sender ‖ contract ‖ nonce)
            </span>{' '}
            — all four pieces are identical for every validator re-executing the transaction, so
            every validator computes the same outcome without trusting the leader.
          </p>
        </div>
      </section>

      {/* ─────────────────────── WHY GENLAYER ─────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            k: 'Sub-second UX',
            v: 'We confirm at status=ACCEPTED, not FINALIZED. The UI never blocks waiting on the consensus tail.',
          },
          {
            k: 'No oracles',
            v: 'gl.nondet.web fetches the result page from inside the contract. Validators each fetch it themselves.',
          },
          {
            k: 'AI-judged, not AI-trusted',
            v: 'Validators each run the LLM and agree under strict equality. One rogue model cannot move the market.',
          },
        ].map((b) => (
          <div key={b.k} className="chip p-5">
            <div className="text-[10px] uppercase tracking-widest text-white/40">{b.k}</div>
            <div className="mt-2 text-white/80">{b.v}</div>
          </div>
        ))}
      </section>

      {/* ─────────────────────── FOOTER ─────────────────────── */}
      <section className="chip p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <h3 className="font-display text-xl font-bold">The contracts</h3>
            <p className="mt-1 text-sm text-white/55">
              Both contracts are deployed and live. Read the source, call them directly, build a
              better UI than this one.
            </p>
            <div className="mt-4 space-y-2 font-mono text-xs">
              <ContractRow label="Sportsbook" addr={SPORTSBOOK_ADDRESS} />
              <ContractRow label="Casino" addr={CASINO_ADDRESS} />
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/55">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Your wallet</div>
            <div className="mt-1 font-mono text-white">
              {address ? `${address.slice(0, 10)}…${address.slice(-6)}` : 'Generating…'}
            </div>
            <div className="mt-3 text-xs">
              A throwaway key was generated in this browser. Persist it from{' '}
              <span className="font-mono">localStorage[&apos;elbalph:pk&apos;]</span>.
            </div>
          </div>
        </div>
      </section>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-1 font-mono text-base font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  code,
}: {
  n: string;
  title: string;
  body: string;
  code: string;
}) {
  return (
    <div className="chip relative overflow-hidden p-5">
      <div className="absolute right-4 top-3 font-display text-5xl font-black text-white/[0.06]">
        {n}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-neon-green">Step {n}</div>
      <div className="mt-1 font-display text-xl font-bold">{title}</div>
      <p className="mt-2 text-sm text-white/60">{body}</p>
      <div className="mt-4 break-words rounded-md border border-white/5 bg-black/40 p-2 font-mono text-[11px] text-neon-green/90">
        {code}
      </div>
    </div>
  );
}

function ContractRow({ label, addr }: { label: string; addr: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-black/30 px-3 py-2">
      <span className="text-white/50">{label}</span>
      <span className="truncate text-neon-green">
        {addr || 'not deployed'}
      </span>
    </div>
  );
}
