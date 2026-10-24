'use client';

/**
 * BitLab — Rendu de code QR local (aucun service externe).
 * Utilisé pour les adresses de réception et les factures Lightning.
 */
import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';
import { tSync } from '@/lib/i18n';

export function QRCode({ value, size = 140, caption }: { value: string; size?: number; caption?: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let alive = true;
    QRCodeLib.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: '#181008', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {
        if (alive) setDataUrl('');
      });
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <figure className="flex flex-col items-center gap-1.5">
      {dataUrl ? (
        <img src={dataUrl} alt={tSync('Code QR : {v}', { v: caption ?? value.slice(0, 40) })} width={size} height={size} className="rounded-md" />
      ) : (
        <div style={{ width: size, height: size }} className="animate-pulse rounded-md bg-muted" aria-label={tSync('Génération du code QR…')} />
      )}
      {caption ? <figcaption className="max-w-[180px] truncate font-mono text-[10px] text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
