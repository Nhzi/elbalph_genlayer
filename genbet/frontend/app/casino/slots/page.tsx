'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { BetSlip } from '@/components/BetSlip';
import { playSlots, playSlotsElf } from '@/lib/contracts';
import { fmtGen, gen, elf, ELF_TOKEN_ADDRESS } from '@/lib/genlayer';

const SlotMachine3D = dynamic(
  () => import('@/components/three/SlotMachine3D').then((m) => m.SlotMachine3D),
  { ssr: false },
);

export default function SlotsPage() {
  const [reels, setReels] = useState<string[] | null>(null);
  const [payout, setPayout] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const handle = async (amount: number) => {
    setReels(null);
    setPayout(null);
    setSpinning(true);
    try {
      const round = ELF_TOKEN_ADDRESS
        ? await playSlotsElf(elf(amount))
        : await playSlots(gen(amount));
      setReels(round?.detail?.reels ?? null);
      setPayout(round?.payout ?? '0');
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="grid gap-6 pt-8 md:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">Slots</h1>
        <SlotMachine3D reels={reels} spinning={spinning} />
        {reels && payout != null && (
          <div className="chip p-4 text-center">
            <div className="font-display text-2xl">{reels.join(' · ')}</div>
            <div className="font-mono">
              Payout:{' '}
              <span className={payout === '0' ? 'text-white/50' : 'text-neon-green'}>
                {fmtGen(payout)} ELF
              </span>
            </div>
          </div>
        )}
      </div>
      <aside className="space-y-3">
        <div className="chip space-y-1 p-4 text-sm text-white/70">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Paytable</div>
          <div>7-7-7 — <span className="text-neon-green">50×</span></div>
          <div>BAR-BAR-BAR — <span className="text-neon-green">20×</span></div>
          <div>Any triple — <span className="text-neon-green">10×</span></div>
          <div>Two 7s — <span className="text-neon-green">5×</span></div>
          <div>Any pair — <span className="text-neon-green">2×</span></div>
        </div>
        <BetSlip onConfirm={handle} cta="Spin Reels" />
      </aside>
    </div>
  );
}
