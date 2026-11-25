'use client';

import { useState } from 'react';
import { Download, Loader2, Lock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import type { LabWallet } from '@/lib/bitcoin/keys';
import {
  decryptWithPassphrase,
  encryptWithPassphrase,
  isEncryptedBlob,
} from '@/lib/bitcoin/crypto-at-rest';

/**
 * Backup chiffré d'un wallet — LOT 20.
 *
 * Objectif v1 : donner à l'utilisateur un moyen concret de sortir un
 * snapshot chiffré de son wallet (mnemonic + WIF + privateKeyHex) qu'il
 * peut stocker hors du navigateur (gestionnaire de mots de passe, cold
 * storage, email à soi-même). Le wallet reste dans IndexedDB en clair
 * tant qu'un LOT futur ne gèrera pas la migration complète.
 *
 * Flow :
 *   1. User clique « Backup chiffré ».
 *   2. Saisit une passphrase (et la confirme).
 *   3. On chiffre `{ mnemonic, wif, privateKeyHex, address, type,
 *      derivationPath, createdAt }` dans un blob JSON → base64url via
 *      crypto-at-rest.
 *   4. Télécharge un fichier `bitlab-backup-<id>-<date>.enc`.
 *   5. User peut re-tester en collant le blob + passphrase dans le même
 *      dialog → « Test déchiffrement » affiche "OK" sans révéler
 *      la plaintext.
 */

interface BackupPayload {
  v: 1;
  walletId: string;
  label: string;
  type: LabWallet['type'];
  network?: LabWallet['network'];
  address: string;
  publicKeyHex: string;
  mnemonic?: string;
  wif: string;
  privateKeyHex: string;
  derivationPath?: string;
  createdAt: number;
  exportedAt: number;
}

function buildPayload(w: LabWallet): BackupPayload {
  return {
    v: 1,
    walletId: w.id,
    label: w.label,
    type: w.type,
    network: w.network,
    address: w.address,
    publicKeyHex: w.publicKeyHex,
    mnemonic: w.mnemonic,
    wif: w.wif,
    privateKeyHex: w.privateKeyHex,
    derivationPath: w.derivationPath,
    createdAt: w.createdAt,
    exportedAt: Date.now(),
  };
}

function downloadTextFile(name: string, content: string): void {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function EncryptedBackupButton({ wallet }: { wallet: LabWallet }) {
  const { t } = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [verifyBlob, setVerifyBlob] = useState('');
  const [verifyPassphrase, setVerifyPassphrase] = useState('');
  const [verifyPending, setVerifyPending] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'idle' | 'ok' | 'ko'>('idle');

  const reset = () => {
    setPassphrase('');
    setConfirm('');
    setVerifyBlob('');
    setVerifyPassphrase('');
    setVerifyResult('idle');
  };

  const onExport = async () => {
    if (passphrase.length < 10) {
      toast({
        variant: 'destructive',
        title: t('Passphrase trop courte'),
        description: t('Au moins 10 caractères.'),
      });
      return;
    }
    if (passphrase !== confirm) {
      toast({
        variant: 'destructive',
        title: t('Confirmation incorrecte'),
        description: t('Les deux passphrases ne correspondent pas.'),
      });
      return;
    }
    setPending(true);
    try {
      const payload = buildPayload(wallet);
      const blob = await encryptWithPassphrase(JSON.stringify(payload), passphrase);
      const stamp = new Date().toISOString().slice(0, 10);
      const safeLabel = (wallet.label || 'wallet').replace(/[^a-z0-9-_]/gi, '-').slice(0, 24);
      downloadTextFile(`bitlab-backup-${safeLabel}-${stamp}.enc`, blob);
      toast({
        title: t('Backup chiffré généré'),
        description: t('Le fichier .enc a été téléchargé. Conserve-le hors de ce navigateur.'),
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('Chiffrement échoué'),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPending(false);
    }
  };

  const onVerify = async () => {
    const trimmed = verifyBlob.trim();
    if (!isEncryptedBlob(trimmed)) {
      setVerifyResult('ko');
      toast({
        variant: 'destructive',
        title: t('Blob invalide'),
        description: t('Format attendu : v1.salt.iv.ciphertext (base64url).'),
      });
      return;
    }
    setVerifyPending(true);
    try {
      await decryptWithPassphrase(trimmed, verifyPassphrase);
      setVerifyResult('ok');
      toast({
        title: t('Déchiffrement OK'),
        description: t('La passphrase est correcte — tu peux restaurer plus tard.'),
      });
    } catch {
      setVerifyResult('ko');
      toast({
        variant: 'destructive',
        title: t('Déchiffrement échoué'),
        description: t('Passphrase incorrecte ou blob altéré.'),
      });
    } finally {
      setVerifyPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 border-emerald-600/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
          title={t('Télécharger un backup chiffré de ce wallet')}
        >
          <Lock className="h-3.5 w-3.5" />
          {t('Backup chiffré')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {t('Backup chiffré du wallet')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Génère un fichier chiffré contenant mnemonic + WIF + clé hex. PBKDF2 310 000 iters + AES-GCM 256 (OWASP 2023).',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="bk-pass">{t('Passphrase (≥ 10 caractères)')}</Label>
            <Input
              id="bk-pass"
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('Passphrase forte, mémorisable mais pas devinable')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-conf">{t('Confirme la passphrase')}</Label>
            <Input
              id="bk-conf"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            {t(
              'Perdre la passphrase = perdre le wallet. Stocke-la hors du navigateur (gestionnaire de mots de passe, papier offline).',
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onExport} disabled={pending} className="gap-1.5">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {pending ? t('Chiffrement…') : t('Générer et télécharger')}
          </Button>
        </DialogFooter>

        <div className="mt-3 border-t pt-3">
          <div className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t('Tester le déchiffrement (optionnel)')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bk-vblob" className="text-xs">
              {t('Colle le blob .enc ici')}
            </Label>
            <Input
              id="bk-vblob"
              value={verifyBlob}
              onChange={(e) => setVerifyBlob(e.target.value)}
              placeholder="1.aaa.bbb.ccc"
              className="font-mono text-xs"
            />
            <Label htmlFor="bk-vpass" className="text-xs">
              {t('Passphrase')}
            </Label>
            <Input
              id="bk-vpass"
              type="password"
              value={verifyPassphrase}
              onChange={(e) => setVerifyPassphrase(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                onClick={onVerify}
                disabled={verifyPending || !verifyBlob || !verifyPassphrase}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {verifyPending ? t('Vérification…') : t('Tester')}
              </Button>
              {verifyResult === 'ok' && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ {t('Blob valide pour cette passphrase')}
                </span>
              )}
              {verifyResult === 'ko' && (
                <span className="text-destructive text-xs font-medium">
                  ✗ {t('Échec de vérification')}
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
