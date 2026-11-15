'use client';

import { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
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
import { useLabStore } from '@/lib/store';
import { isLocked, type AnyWallet } from '@/lib/bitcoin/wallet-lock';

/**
 * Bouton Lock / Unlock pour un wallet (LOT 76).
 *
 * - Si wallet en clair → bouton « Verrouiller » (icon Lock emerald).
 *   Prompt passphrase + confirmation, chiffre les secrets, met à
 *   jour le store (le wallet devient LockedWallet dans IndexedDB).
 *
 * - Si wallet locked → bouton « Déverrouiller » (icon Unlock amber).
 *   Prompt passphrase, déchiffre + met en session cache 30 min.
 *   Les actions signantes (TX, mining, LN) voient le wallet comme
 *   déverrouillé via `useActiveWallet()` pendant 30 min.
 */
export function WalletLockButton({ wallet }: { wallet: AnyWallet }) {
  const { t } = useT();
  const { toast } = useToast();
  const lockWallet = useLabStore((s) => s.lockWallet);
  const unlockWallet = useLabStore((s) => s.unlockWallet);
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);

  const locked = isLocked(wallet);

  const reset = () => {
    setPassphrase('');
    setConfirm('');
  };

  const onSubmit = async () => {
    if (passphrase.length < 10) {
      toast({
        variant: 'destructive',
        title: t('Passphrase trop courte'),
        description: t('Au moins 10 caractères.'),
      });
      return;
    }
    if (!locked && passphrase !== confirm) {
      toast({
        variant: 'destructive',
        title: t('Confirmation incorrecte'),
        description: t('Les deux passphrases ne correspondent pas.'),
      });
      return;
    }
    setPending(true);
    try {
      if (locked) {
        await unlockWallet(wallet.id, passphrase);
        toast({
          title: t('Wallet déverrouillé'),
          description: t('Accessible 30 min — tu peux signer des transactions.'),
        });
      } else {
        await lockWallet(wallet.id, passphrase);
        toast({
          title: t('Wallet verrouillé'),
          description: t('Les secrets sont chiffrés dans IndexedDB.'),
        });
      }
      setOpen(false);
      reset();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: locked ? t('Déverrouillage échoué') : t('Verrouillage échoué'),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPending(false);
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
          className={
            locked
              ? 'h-7 gap-1.5 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400'
              : 'h-7 gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
          }
          title={
            locked
              ? t('Déverrouiller pour pouvoir signer (30 min)')
              : t('Verrouiller : les secrets seront chiffrés dans IndexedDB')
          }
        >
          {locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {locked ? t('Déverrouiller') : t('Verrouiller')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {locked ? t('Déverrouiller le wallet') : t('Verrouiller le wallet')}
          </DialogTitle>
          <DialogDescription>
            {locked
              ? t(
                  'Entre la passphrase pour reconstituer les secrets en mémoire. Session active 30 min.',
                )
              : t(
                  'Chiffre mnemonic + WIF + clé hex dans IndexedDB. Pour signer ensuite, un unlock sera requis (30 min de cache).',
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lk-pass">{t('Passphrase (≥ 10 caractères)')}</Label>
            <Input
              id="lk-pass"
              type="password"
              autoComplete={locked ? 'current-password' : 'new-password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('Passphrase forte, mémorisable mais pas devinable')}
            />
          </div>
          {!locked && (
            <div className="space-y-1.5">
              <Label htmlFor="lk-conf">{t('Confirme la passphrase')}</Label>
              <Input
                id="lk-conf"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            {locked
              ? t(
                  'Perdre la passphrase = perdre le wallet (aucun reset serveur — c\'est l\'essence non-custodial).',
                )
              : t(
                  'Perdre la passphrase = perdre le wallet. Stocke-la hors du navigateur (gestionnaire de mots de passe, papier offline).',
                )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onSubmit} disabled={pending} className="gap-1.5">
            {pending
              ? t('…')
              : locked
                ? t('Déverrouiller')
                : t('Verrouiller maintenant')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
