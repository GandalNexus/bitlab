'use client';

/**
 * BitLab — Sidebar à la Stellar Lab (lab.stellar.org).
 * Navigation sections, active item in full pill (4px radius, accent tint),
 * "Resources" section anchored at bottom (guide first, then external links).
 * Desktop: collapse button (icon rail) — state persisted in localStorage.
 * Slide drawer on mobile.
 */
import { useCallback, useSyncExternalStore, type ComponentType } from 'react';
import Link from 'next/link';
import {
  Blocks,
  BookOpen,
  ExternalLink,
  FileText,
  FlaskConical,
  Hammer,
  KeySquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pickaxe,
  Radio,
  ScanSearch,
  Wallet,
  Waypoints,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { explorerBase } from '@/lib/mempool';
import { useT } from '@/lib/i18n';

export type TabId = 'dashboard' | 'portefeuille' | 'transactions' | 'lightning' | 'mineur' | 'explorateur';

export const COLLAPSE_KEY = 'bitlab-sidebar-collapsed';

/** Mini-store externe : repli de la barre latérale persisté en localStorage. */
const collapseStore = {
  listeners: new Set<() => void>(),
  get(): boolean {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  },
  set(v: boolean) {
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
    } catch {
      /* stockage indisponible */
    }
    collapseStore.listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    collapseStore.listeners.add(l);
    return () => {
      collapseStore.listeners.delete(l);
    };
  },
};

/** Persistent collapse state (shared between shell and sidebar). */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(collapseStore.subscribe, collapseStore.get, () => false);
  const toggle = useCallback(() => collapseStore.set(!collapseStore.get()), []);
  return { collapsed, toggle };
}

interface NavItem {
  id: TabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Lab',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: Blocks },
      { id: 'portefeuille', label: 'Wallet', icon: Wallet },
    ],
  },
  {
    label: 'Modules',
    items: [
      { id: 'transactions', label: 'Transactions', icon: Hammer },
      { id: 'lightning', label: 'Lightning Network', icon: Radio },
      { id: 'mineur', label: 'Miner', icon: Pickaxe },
      { id: 'explorateur', label: 'Explorer', icon: ScanSearch },
    ],
  },
];
/** Guide link only - simplified resources */
const RESOURCE_LINKS: {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  external: boolean;
}[] = [
  { label: 'Guide', href: '/guide', icon: BookOpen, external: false },
];

/* ──────────────────────────────  Navigation  ────────────────────────────── */

function NavButton({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
  href,
  external,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}) {
  const cls = cn(
    'group flex w-full items-center gap-2.5 rounded-[4px] px-3 py-2 text-sm transition-colors',
    collapsed && 'justify-center px-0',
    active
      ? 'bg-primary/15 font-medium text-primary'
      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
  );
  const inner = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : <span className="sr-only">{label}</span>}
      {external && !collapsed ? (
        <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
      ) : null}
    </>
  );
  const tip = collapsed ? label : undefined;
  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noreferrer" title={tip} aria-label={label} className={cls}>
        {inner}
      </a>
    ) : (
      <Link href={href} title={tip} aria-label={label} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined} title={tip} aria-label={label} className={cls}>
      {inner}
    </button>
  );
}

export function SidebarNav({
  active,
  onNavigate,
  collapsed = false,
}: {
  active: TabId;
  onNavigate: (id: TabId) => void;
  collapsed?: boolean;
}) {
  const { t } = useT();
  return (
    <nav aria-label={t('Navigation du laboratoire')} className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4 scrollbar-thin">
      {SECTIONS.map((section) => (
        <div key={section.label} className="space-y-0.5">
          {!collapsed ? (
            <div className="nav-section-label px-3 pb-1.5 text-muted-foreground/70">{t(section.label)}</div>
          ) : (
            <div className="mx-3 mb-2 border-t border-border/60" aria-hidden />
          )}
          {section.items.map((item) => (
            <NavButton
              key={item.id}
              icon={item.icon}
              label={t(item.label)}
              active={active === item.id}
              collapsed={collapsed}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
      ))}

      {/* Guide */}
      <div className="space-y-0.5 border-t border-border/60 pt-4">
        {!collapsed ? (
          <div className="nav-section-label px-3 pb-1.5 text-muted-foreground/70">{t('Guide')}</div>
        ) : (
          <div className="mx-3 mb-2 border-t border-border/40" aria-hidden />
        )}
        {RESOURCE_LINKS.map((r) => (
          <NavButton
            key={r.label}
            icon={r.icon}
            label={t(r.label)}
            collapsed={collapsed}
            href={r.href}
            external={r.external}
          />
        ))}
      </div>
    </nav>
  );
}

/* ──────────────────────────────  Coquille  ────────────────────────────── */

/** Panneau latéral desktop (fixe, repliable) + drawer mobile (overlay). */
export function LabSidebar({
  active,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  collapsed = false,
  onToggleCollapsed,
}: {
  active: TabId;
  onNavigate: (id: TabId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t } = useT();
  return (
    <>
      {/* Desktop : colonne fixe, repliable en rail icônes */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-background transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <SidebarNav active={active} onNavigate={onNavigate} collapsed={collapsed} />

        <div className="border-t border-border/60 p-2">
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t('Déplier la barre latérale') : t('Replier la barre latérale')}
            title={collapsed ? t('Déplier') : t('Replier')}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-[6px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed ? <span className="text-xs">{t('Replier')}</span> : null}
          </button>
        </div>
      </aside>

      {/* Mobile : drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={onCloseMobile}
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-background shadow-2xl transition-transform duration-200 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <SidebarNav
            active={active}
            onNavigate={(id) => {
              onNavigate(id);
              onCloseMobile();
            }}
          />
        </aside>
      </div>
    </>
  );
}

/** Brand mark: lab icon + "BitLab" text. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-primary text-primary-foreground">
        <Zap className="h-4.5 w-4.5" />
      </div>
      {!compact ? (
        <span className="text-[15px] font-semibold tracking-tight">BitLab</span>
      ) : null}
    </div>
  );
}
