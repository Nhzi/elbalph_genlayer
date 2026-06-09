'use client';

import { useEffect } from 'react';
import { getAccount, getClient } from '@/lib/genlayer';
import { getBalance } from '@/lib/contracts';
import { useStore } from '@/lib/store';

export function GenLayerProvider({ children }: { children: React.ReactNode }) {
  const setAddress = useStore((s) => s.setAddress);
  const setBalance = useStore((s) => s.setBalance);

  useEffect(() => {
    // Touch the singleton client so it's warm before the first call.
    getClient();
    const acct = getAccount();
    if (!acct) return;
    setAddress(acct.address as `0x${string}`);

    let cancelled = false;
    const refresh = async () => {
      try {
        const bal = await getBalance(acct.address as `0x${string}`);
        if (!cancelled) setBalance(bal);
      } catch {
        // Ignore — happens if RPC isn't up yet.
      }
    };
    refresh();
    const t = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [setAddress, setBalance]);

  return <>{children}</>;
}
