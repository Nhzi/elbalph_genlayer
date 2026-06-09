'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store';
import { fmtGen } from '@/lib/genlayer';

const tabs = [
  { href: '/', label: 'Lobby' },
  { href: '/sports', label: 'Sports' },
  { href: '/casino', label: 'Casino' },
];

export function Header() {
  const pathname = usePathname();
  const address = useStore((s) => s.address);
  const balanceWei = useStore((s) => s.balanceWei);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-ink/60 border-b border-white/5">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-neon-green shadow-glow" />
          <span className="font-display text-lg font-bold tracking-tight">
            gen<span className="text-neon-green">bet</span>
          </span>
          <span className="pill ml-2 text-white/70">GenLayer L2</span>
        </Link>

        <nav className="flex items-center gap-1">
          {tabs.map((t) => {
            const active = t.href === '/' ? pathname === '/' : pathname?.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Balance</div>
            <div className="font-mono text-sm text-neon-green">{fmtGen(balanceWei, 3)} GEN</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs">
            {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'}
          </div>
        </div>
      </div>
    </header>
  );
}
