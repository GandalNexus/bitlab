'use client';

import { useEffect, useRef } from 'react';
import { lnLab } from '@/lib/lightning';
import { useLabStore } from '@/lib/store';

export function LnLabRestorer() {
  const net = useLabStore((s) => s.network);
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return;
    const st = lnLab.getStatus();
    if (st.phase !== 'off' || st.error) return;
    const wanted = lnLab.desiredNets().find((n) => n === net) ?? lnLab.desiredNets()[0];
    if (!wanted) return;
    tried.current = true;
    void lnLab.activate(wanted);
  }, [net]);

  return null;
}
