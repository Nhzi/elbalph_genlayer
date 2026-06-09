'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { BetSlip } from '@/components/BetSlip';
import { playDice } from '@/lib/contracts';
import { fmtGen, gen } from '@/lib/genlayer';

const Dice3D = dynamic(() => import('@/components/three/Dice3D').then((m) => m.Dice3D), {
  ssr: false,
});

export default function DicePage() {
  const [target, setTarget] = useState(50);
  const [roll, setRoll] = useState<number | null>(null);
  const [payout, setPayout] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const multiplier = (98 / target).toFixed(2);
  const winChance = target;

  const handle = async (amount: number) => {
    setRoll(null);
    setPayout(null);
    setSpinning(true);
    try {
      const round = await playDice(target, gen(amount));
      setRoll(round?.detail?.roll ?? null);
      setPayout(round?.payout ?? '0');
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="grid gap-6 pt-8 md:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">Dice</h1>
        <Dice3D roll={roll} spinning={spinning} />
        {roll != null && payout != null && (
          <div className="chip p-4 text-center">
            <div className="font-display text-2xl">
              Rolled {roll} {roll <= target ? '✓ Win' : '✗ Lose'}
            </div>
            <div className="font-mono">
              Payout:{' '}
              <span className={payout === '0' ? 'text-white/50' : 'text-neon-green'}>
                {fmtGen(payout)} GEN
              </span>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-3">
        <div className="chip space-y-3 p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">Roll under</div>
              <div className="font-display text-3xl font-bold">{target}</div>
            </div>
            <div className="text-right text-xs text-white/60">
              <div>Win chance: {winChance}%</div>
              <div>
                Payout: <span className="text-neon-green">{multiplier}×</span>
              </div>
            </div>
          </div>
          <input
            type="range"
            min={2}
            max={95}
            step={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="accent-neon-cyan"
          />
        </div>
        <BetSlip onConfirm={handle} cta="Roll" />
      </aside>
    </div>
  );
}
