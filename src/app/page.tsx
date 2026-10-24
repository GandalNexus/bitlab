'use client';

/**
 * BitLab — main page, sole visible route.
 * Shell like Stellar Lab: fixed sidebar left (mobile drawer),
 * full-width top bar, content area right.
 * Modules: Dashboard, Wallet, Transactions, Lightning, Miner, Explorer.
 */
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LabHeader } from '@/components/bitlab/header';
import { LabSidebar, useSidebarCollapsed, type TabId } from '@/components/bitlab/sidebar';
import { Dashboard } from '@/components/bitlab/dashboard';
import { WalletModule } from '@/components/bitlab/wallet';
import { TxBuilder } from '@/components/bitlab/tx-builder';
import { LightningModule } from '@/components/bitlab/lightning';
import { MiningModule } from '@/components/bitlab/mining-lab';
import { ExplorerModule } from '@/components/bitlab/explorer';
import { useLabStore } from '@/lib/store';
import { NETWORKS } from '@/lib/networks';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function BitLabPage() {
  const { t } = useT();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } },
      }),
  );
  const [tab, setTab] = useState<TabId>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const hydrate = useLabStore((s) => s.hydrate);
  const net = useLabStore((s) => s.network);
  const netLabel = NETWORKS[net].label;
  const realFunds = NETWORKS[net].realFunds;

  // Load lab state from IndexedDB (client mount only).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen">
        <LabSidebar
          active={tab}
          onNavigate={(id) => setTab(id)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />

        <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200 ease-out', sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-64')}>
          <LabHeader onOpenMobileNav={() => setMobileNavOpen(true)} />

          {/* Contenu */}
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
            {tab === 'dashboard' ? <Dashboard onNavigate={(t) => setTab(t as TabId)} /> : null}
            {tab === 'portefeuille' ? <WalletModule /> : null}
            {tab === 'transactions' ? <TxBuilder /> : null}
            {tab === 'lightning' ? <LightningModule /> : null}
            {tab === 'mineur' ? <MiningModule /> : null}
            {tab === 'explorateur' ? <ExplorerModule /> : null}
          </main>

          {/* Pied de page discret — rappel du réseau actif uniquement */}
          <footer className="mt-auto border-t border-border/70 bg-card/40 py-3.5">
            <div className="mx-auto flex max-w-5xl justify-center px-4 text-[11px] text-muted-foreground sm:px-6">
              <span className={cn('text-muted-foreground/70', realFunds && 'text-amber-600 dark:text-amber-500/90')}>
                {t('{net} · clés 100 % locales', { net: netLabel })}
              </span>
            </div>
          </footer>
        </div>
      </div>
    </QueryClientProvider>
  );
}
