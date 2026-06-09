import Link from 'next/link';

export default function Lobby() {
  return (
    <div className="space-y-12 pt-10">
      <section className="text-center">
        <div className="pill mx-auto mb-4 text-white/70">Powered by GenLayer · Optimistic Democracy</div>
        <h1 className="font-display text-5xl font-bold leading-tight sm:text-6xl">
          Bet at the speed of <span className="text-neon-green">AI consensus</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-white/60">
          Sports markets resolved by validators reading the score directly off the web. Provably-fair
          casino games settled in seconds. One wallet, two tabs, zero oracles.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <Link href="/sports" className="chip group block overflow-hidden">
          <div className="bg-gradient-to-br from-neon-green/15 to-transparent p-6">
            <div className="pill mb-3 text-neon-green border-neon-green/30">Sports</div>
            <h2 className="font-display text-3xl font-bold">Bet on real games</h2>
            <p className="mt-2 text-white/60">
              Pari-mutuel pools on real-world matches. Contract scrapes the result page; AI consensus
              picks the winner. No oracle, no admin, no funny business.
            </p>
            <div className="mt-4 text-neon-green opacity-0 transition group-hover:opacity-100">Open sportsbook →</div>
          </div>
        </Link>

        <Link href="/casino" className="chip group block overflow-hidden">
          <div className="bg-gradient-to-br from-neon-pink/15 to-transparent p-6">
            <div className="pill mb-3 text-neon-pink border-neon-pink/30">Casino</div>
            <h2 className="font-display text-3xl font-bold">Instant settled games</h2>
            <p className="mt-2 text-white/60">
              Coinflip, dice, roulette, slots. Every round seeded from on-chain entropy — auditable
              outcome, paid in one transaction.
            </p>
            <div className="mt-4 text-neon-pink opacity-0 transition group-hover:opacity-100">Enter casino →</div>
          </div>
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { k: 'Sub-second UX', v: 'We confirm at ACCEPTED, not FINALIZED — UI never blocks on consensus.' },
          { k: 'No oracles', v: 'gl.nondet.web fetches results inside the contract.' },
          { k: 'AI-judged', v: 'Validators independently extract the winner via LLM and vote.' },
        ].map((b) => (
          <div key={b.k} className="chip p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40">{b.k}</div>
            <div className="mt-1 text-sm text-white/80">{b.v}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
