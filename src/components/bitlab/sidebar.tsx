'use client';

/**
 * BitLab - Sidebar styled after Stellar Lab (lab.stellar.org).
 * Navigation sections with the active item as a filled pill (4px radius,
 * accent tint); the developer guide pinned at the bottom (single entry,
 * no section label). Desktop: collapse button (icon rail) persisted in
 * localStorage. Sliding drawer on mobile.
 */
import { useCallback, useEffect, useSyncExternalStore, type ComponentType } from 'react';
import Link from 'next/link';
import {
  Blocks,
  BookOpen,
  ExternalLink,
  Hammer,
  PanelLeftClose,
  PanelLeftOpen,
  Pickaxe,
  Radio,
  ScanSearch,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export type TabId = 'dashboard' | 'portefeuille' | 'transactions' | 'lightning' | 'mineur' | 'explorateur';

export const COLLAPSE_KEY = 'bitlab-sidebar-collapsed';

/** Tiny external store: sidebar collapse state persisted in localStorage. */
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
      /* storage unavailable */
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

/** Persisted collapsed state (shared between the shell and the sidebar). */
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
    label: 'Laboratoire',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: Blocks },
      { id: 'portefeuille', label: 'Portefeuille', icon: Wallet },
    ],
  },
  {
    label: 'Modules',
    items: [
      { id: 'transactions', label: 'Transactions', icon: Hammer },
      { id: 'lightning', label: 'Lightning Network', icon: Radio },
      { id: 'mineur', label: 'Mineur', icon: Pickaxe },
      { id: 'explorateur', label: 'Explorateur', icon: ScanSearch },
    ],
  },
];
/** Resources: only the developer guide - the lab documents itself in-app. */
const RESOURCE_LINKS: {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  external: boolean;
}[] = [
  { label: 'Guide développeur', href: '/guide', icon: BookOpen, external: false },
];

// --- Navigation ---

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
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
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

      {/* Guide - single resource entry, directly under the separator */}
      <div className="space-y-0.5 border-t border-border/60 pt-4">
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

// --- Shell ---

/** Desktop side panel (fixed, collapsible) + mobile drawer (overlay). */
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

  // Escape closes the mobile drawer while it is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {/* Desktop: fixed column, collapsible to an icon rail */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-background transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-border/70', collapsed ? 'justify-center px-2' : 'gap-2 px-4')}>
          <Link href="/" aria-label="BitLab" className="flex items-center gap-2 overflow-hidden">
            <BrandMark compact={collapsed} />
          </Link>
        </div>

        <SidebarNav active={active} onNavigate={onNavigate} collapsed={collapsed} />

        <div className="border-t border-border/60 p-2">
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t('Déplier la barre latérale') : t('Replier la barre latérale')}
            title={collapsed ? t('Déplier') : t('Replier')}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-[6px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed ? <span className="text-xs">{t('Replier')}</span> : null}
          </button>
        </div>
      </aside>

      {/* Mobile: drawer */}
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
          {/* Drawer header - brand + explicit close (the backdrop also closes) */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/70 px-4">
            <BrandMark />
            <button
              onClick={onCloseMobile}
              aria-label={t('Fermer la navigation')}
              title={t('Fermer la navigation')}
              className="flex h-9 w-9 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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

/** Brand block: lab icon + "BitLab" + "Lab" pill (Stellar signature). */
export function BrandMark({ compact = false, responsive = false }: { compact?: boolean; responsive?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-primary text-primary-foreground">
        <Zap className="h-4.5 w-4.5" />
      </div>
      {!compact ? (
        <>
          {/* responsive : pastille et mot-symbole masqués sous 400 px — l'icône
              seule suffit dans l'en-tête mobile, sinon la barre déborde. */}
          <span className={cn('text-[15px] font-semibold tracking-tight', responsive && 'hidden min-[400px]:inline')}>
            BitLab
          </span>
          <span
            className={cn(
              'rounded-full border border-primary/40 bg-primary/10 px-2 py-px text-[11px] font-medium text-primary',
              responsive && 'hidden min-[400px]:inline-block',
            )}
          >
            Lab
          </span>
        </>
      ) : null}
    </div>
  );
}
