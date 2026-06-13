'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  connectInjected,
  disconnectInjected,
  fmtGen,
  fmtElf,
  hasInjectedProvider,
  setMode as persistMode,
  ELF_TOKEN_ADDRESS,
} from '@/lib/genlayer';
import { elfClaimFaucet } from '@/lib/contracts';

const tabs = [
  { href: '/', label: 'Lobby' },
  { href: '/sports', label: 'Sports' },
  { href: '/casino', label: 'Casino' },
];

export function Header() {
  const pathname = usePathname();
  const address = useStore((s) => s.address);
  const balanceWei = useStore((s) => s.balanceWei);
  const elfBalanceWei = useStore((s) => s.elfBalanceWei);
  const hasClaimedFaucet = useStore((s) => s.hasClaimedFaucet);
  const setElfBalance = useStore((s) => s.setElfBalance);
  const setHasClaimedFaucet = useStore((s) => s.setHasClaimedFaucet);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const toggleMode = useCallback(async () => {
    if (busy) return;
    setErr(null);
    const next = mode === 'ANON' ? 'MKMC' : 'ANON';
    if (next === 'MKMC') {
      if (!hasInjectedProvider()) {
        setErr('No injected wallet found. Install MetaMask and reload.');
        return;
      }
      setBusy(true);
      try {
        await connectInjected();
        persistMode('MKMC');
        setMode('MKMC');
      } catch (e: any) {
        setErr(e?.shortMessage ?? e?.message ?? 'Wallet connect failed.');
      } finally {
        setBusy(false);
      }
    } else {
      // Going back to ANON — drop the cached injected handle so the next
      // switch re-prompts cleanly.
      disconnectInjected();
      persistMode('ANON');
      setMode('ANON');
    }
  }, [mode, busy, setMode]);

  const claimFaucet = useCallback(async () => {
    if (claiming || !ELF_TOKEN_ADDRESS) return;
    setClaimMsg(null);
    setClaiming(true);
    try {
      await elfClaimFaucet();
      setHasClaimedFaucet(true);
      setElfBalance(elfBalanceWei + 100000n * 10n ** 18n);
      setClaimMsg('+100,000 ELF claimed');
      setTimeout(() => setClaimMsg(null), 2500);
    } catch (e: any) {
      setClaimMsg(e?.shortMessage ?? e?.message ?? 'Faucet failed');
      setTimeout(() => setClaimMsg(null), 3500);
    } finally {
      setClaiming(false);
    }
  }, [claiming, elfBalanceWei, setElfBalance, setHasClaimedFaucet]);

  const copyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard may be blocked on insecure origins — silently ignore.
    }
  }, [address]);

  const modePillClass =
    mode === 'MKMC'
      ? 'border-neon-pink/40 bg-neon-pink/10 text-neon-pink'
      : 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan';

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-ink/60 border-b border-white/5">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="relative inline-flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-0 rounded-md bg-gradient-to-br from-neon-green via-neon-cyan to-neon-pink shadow-glow" />
            <span className="relative font-display text-[11px] font-black text-black">E</span>
          </span>
          <span className="font-display text-lg font-bold tracking-[0.18em]">
            ELBA<span className="text-neon-green">LPH</span>
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

        <div className="hidden items-center gap-2 sm:flex">
          <div className="text-right leading-tight">
            <div className="text-[10px] uppercase tracking-wider text-white/40">ELF</div>
            <div className="font-mono text-sm text-neon-gold">{fmtElf(elfBalanceWei, 2)}</div>
          </div>
          <div className="text-right leading-tight">
            <div className="text-[10px] uppercase tracking-wider text-white/40">GEN</div>
            <div className="font-mono text-sm text-neon-green">{fmtGen(balanceWei, 3)}</div>
          </div>

          {ELF_TOKEN_ADDRESS && (
            <button
              type="button"
              onClick={claimFaucet}
              disabled={claiming || hasClaimedFaucet}
              title={
                hasClaimedFaucet
                  ? 'Faucet already claimed for this address'
                  : 'Claim 100,000 ELF to start playing'
              }
              className="rounded-lg border border-neon-gold/40 bg-neon-gold/10 px-2.5 py-1.5 text-[11px] font-bold tracking-wider text-neon-gold transition hover:brightness-125 disabled:opacity-40"
            >
              {claiming ? '…' : hasClaimedFaucet ? 'CLAIMED' : 'FAUCET'}
            </button>
          )}

          <button
            type="button"
            onClick={toggleMode}
            disabled={busy}
            title={
              mode === 'ANON'
                ? 'Currently using a browser-generated key. Click to connect an injected wallet (MKMC: My Keys, My Crypto).'
                : 'Currently using your injected wallet. Click to switch back to the local ANON key.'
            }
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold tracking-wider transition hover:brightness-125 disabled:opacity-50 ${modePillClass}`}
          >
            {busy ? '…' : mode}
          </button>

          <button
            type="button"
            onClick={copyAddress}
            title={address ?? 'No wallet'}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] tracking-tight transition hover:bg-white/10"
          >
            {address ? (copied ? 'Copied!' : address) : '—'}
          </button>
        </div>
      </div>

      {/* Mobile-only fund bar: ELF balance + faucet sit next to the address. */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 pb-2 sm:hidden">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-white/40">ELF</span>
          <span className="font-mono text-neon-gold">{fmtElf(elfBalanceWei, 2)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {ELF_TOKEN_ADDRESS && (
            <button
              type="button"
              onClick={claimFaucet}
              disabled={claiming || hasClaimedFaucet}
              className="rounded-md border border-neon-gold/40 bg-neon-gold/10 px-2 py-1 text-[10px] font-bold tracking-wider text-neon-gold disabled:opacity-40"
            >
              {claiming ? '…' : hasClaimedFaucet ? 'CLAIMED' : 'FAUCET'}
            </button>
          )}
          <button
            type="button"
            onClick={copyAddress}
            title={address ?? 'No wallet'}
            className="max-w-[120px] truncate rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[9px] tracking-tight"
          >
            {address ? (copied ? 'Copied!' : `${address.slice(0, 6)}…${address.slice(-4)}`) : '—'}
          </button>
        </div>
      </div>

      {(err || claimMsg) && (
        <div className="mx-auto max-w-6xl px-4 pb-2 text-right text-[11px]">
          {err && <span className="text-neon-pink">{err}</span>}
          {claimMsg && <span className="ml-3 text-neon-gold">{claimMsg}</span>}
        </div>
      )}
    </header>
  );
}
