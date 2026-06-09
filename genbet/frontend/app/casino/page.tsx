import Link from 'next/link';

const games = [
  { href: '/casino/coinflip', name: 'Coinflip', tag: '1.95×', accent: 'from-neon-gold/20' },
  { href: '/casino/dice', name: 'Dice', tag: 'up to 49×', accent: 'from-neon-cyan/20' },
  { href: '/casino/roulette', name: 'Roulette', tag: '35× on number', accent: 'from-neon-pink/20' },
  { href: '/casino/slots', name: 'Slots', tag: '50× on 7-7-7', accent: 'from-neon-green/20' },
];

export default function CasinoLobby() {
  return (
    <div className="space-y-6 pt-8">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-bold">Casino</h1>
        <span className="pill">Provably fair · on-chain entropy</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((g) => (
          <Link key={g.href} href={g.href} className="chip group block overflow-hidden">
            <div className={`bg-gradient-to-br ${g.accent} to-transparent p-5`}>
              <div className="pill mb-3 text-white/80">{g.tag}</div>
              <div className="font-display text-2xl font-bold">{g.name}</div>
              <div className="mt-3 text-sm text-white/60">Play →</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
