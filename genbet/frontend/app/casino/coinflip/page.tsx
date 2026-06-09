'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { BetSlip } from '@/components/BetSlip';
import { playCoinflip } from '@/lib/contracts';
import { fmtGen, gen } from '@/lib/genlayer';

const CoinFlip3D = dynamic(() => import('@/components/three/CoinFlip3D').then((m) => m.CoinFlip3D), {
  ssr: false,
});

export default function CoinflipPage() {
  const [callHeads, setCallHeads] = useState(true);
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [payout, setPayout] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const handle = async (amount: number) => {
    setResult(null);
    setPayout(null);
    setSpinning(true);
    try {
      const round = await playCoinflip(callHeads, gen(amount));
      const landed = round?.detail?.landed === 'heads' ? 'heads' : 'tails';
      setResult(landed);
      setPayout(round?.payout ?? '0');
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="grid gap-6 pt-8 md:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold">Coinflip</h1>
        <CoinFlip3D result={result} spinning={spinning} />
        {result && (
          <div className="chip p-4 text-center">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Result</div>
            <div className="font-display text-3xl font-bold">
              Landed <span className="text-neon-gold">{result.toUpperCase()}</span>
            </div>
            {payout !== null && (
              <div className="mt-1 font-mono text-sm">
                Payout:{' '}
                <span className={payout === '0' ? 'text-white/50' : 'text-neon-green'}>
                  {fmtGen(payout)} GEN
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-3">
        <div className="chip p-4">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Call</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['heads', 'tails'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setCallHeads(s === 'heads')}
                className={`rounded-lg border px-3 py-3 text-center transition ${
                  (callHeads ? 'heads' : 'tails') === s
                    ? 'border-neon-green bg-neon-green/10 text-neon-green shadow-glow'
                    : 'border-white/10 hover:bg-white/5'
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <BetSlip onConfirm={handle} cta="Flip" />
      </aside>
    </div>
  );
}
