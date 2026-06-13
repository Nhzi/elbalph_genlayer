'use client';

import { useState } from 'react';

type Props = {
  defaultAmount?: number;
  onConfirm: (amount: number) => Promise<void> | void;
  disabled?: boolean;
  cta?: string;
  helper?: React.ReactNode;
  currency?: string;
};

const PRESETS = [0.1, 0.5, 1, 5, 10];

export function BetSlip({
  defaultAmount = 1,
  onConfirm,
  disabled,
  cta = 'Place Bet',
  helper,
  currency = 'ELF',
}: Props) {
  const [amount, setAmount] = useState(defaultAmount);
  const [busy, setBusy] = useState(false);

  const click = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onConfirm(amount);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chip flex flex-col gap-3 p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">Stake</div>
          <div className="font-display text-3xl font-bold tabular-nums">
            {amount.toFixed(2)} <span className="text-base text-white/40">{currency}</span>
          </div>
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                amount === p ? 'bg-neon-green text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <input
        type="range"
        min={0.01}
        max={50}
        step={0.01}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="accent-neon-green"
      />

      {helper}

      <button onClick={click} disabled={busy || disabled} className="btn-primary w-full text-base">
        {busy ? 'Submitting…' : cta}
      </button>
    </div>
  );
}
