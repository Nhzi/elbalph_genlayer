'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { BetSlip } from '@/components/BetSlip';
import { playRoulette } from '@/lib/contracts';
import { fmtGen, gen } from '@/lib/genlayer';

const Roulette3D = dynamic(() => import('@/components/three/Roulette3D').then((m) => m.Roulette3D), {
  ssr: false,
});

type BetType = 'number' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high';

export default function RoulettePage() {
  const [betType, setBetType] = useState<BetType>('red');
  const [betNumber, setBetNumber] = useState(7);
  const [spin, setSpin] = useState<number | null>(null);
  const [payout, setPayout] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const handle = async (amount: number) => {
    setSpin(null);
    setPayout(null);
    setSpinning(true);
    try {
      const round = await playRoulette(betType, betNumber, gen(amount));
      setSpin(round?.detail?.spin ?? null);
      setPayout(round?.payout ?? '0');
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="grid gap-6 pt-8 md:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">Roulette</h1>
        <Roulette3D spin={spin} spinning={spinning} />
        {spin != null && payout != null && (
          <div className="chip p-4 text-center">
            <div className="font-display text-2xl">
              Landed on {spin}{' '}
              {payout !== '0' ? <span className="text-neon-green">— Win</span> : <span className="text-white/50">— Lose</span>}
            </div>
            <div className="font-mono">Payout: {fmtGen(payout)} GEN</div>
          </div>
        )}
      </div>

      <aside className="space-y-3">
        <div className="chip space-y-3 p-4">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Bet type</div>
          <div className="grid grid-cols-3 gap-2">
            {(['red', 'black', 'even', 'odd', 'low', 'high'] as BetType[]).map((t) => (
              <button
                key={t}
                onClick={() => setBetType(t)}
                className={`rounded-lg border px-2 py-2 text-sm capitalize transition ${
                  betType === t
                    ? 'border-neon-green bg-neon-green/10 text-neon-green'
                    : 'border-white/10 hover:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => setBetType('number')}
              className={`col-span-3 rounded-lg border px-2 py-2 text-sm transition ${
                betType === 'number'
                  ? 'border-neon-pink bg-neon-pink/10 text-neon-pink'
                  : 'border-white/10 hover:bg-white/5'
              }`}
            >
              Straight up — number {betNumber} <span className="ml-2 text-xs text-white/60">(35×)</span>
            </button>
          </div>
          {betType === 'number' && (
            <input
              type="range"
              min={0}
              max={36}
              step={1}
              value={betNumber}
              onChange={(e) => setBetNumber(Number(e.target.value))}
              className="accent-neon-pink"
            />
          )}
        </div>
        <BetSlip onConfirm={handle} cta="Spin" />
      </aside>
    </div>
  );
}
