'use client';

/**
 * BitLab - Sidebar styled after Stellar Lab (lab.stellar.org).
 * Navigation sections with the active item as a filled pill (4px radius,
 * accent tint); the developer guide pinned at the bottom (single entry,
 * no section label). Desktop: collapse button (icon rail) persisted in
 * localStorage. Sliding drawer on mobile.
 */
import { useCallback, useEffect, useState, useSyncExternalStore, type ComponentType } from 'react';
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
  { label: 'Guide', href: '/guide', icon: BookOpen, external: false },
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

/** Desktop side panel (fixed, collapsible) + mobile drawer (overlay).
 *  The full-width header cluster (banner + header) sits above the panel; its
 *  exact height is measured with a ResizeObserver so the panel always starts
 *  right below it — banner visible, dismissed or wrapped alike. */
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

  // Keep the fixed panel flush under the sticky top cluster.
  const [clusterTop, setClusterTop] = useState(56);
  useEffect(() => {
    const cluster = document.getElementById('lab-top-cluster');
    if (!cluster) return;
    const update = () => setClusterTop(cluster.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(cluster);
    return () => ro.disconnect();
  }, []);

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
      {/* Desktop: fixed column below the full-width header cluster, collapsible to an icon rail.
          No brand row — the logo lives in the header above. */}
      <aside
        style={{ top: clusterTop }}
        className={cn(
          'fixed bottom-0 left-0 z-30 hidden flex-col border-r border-border bg-background transition-[top,width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
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
          {/* Drawer header - explicit close only (the backdrop also closes);
              the brand stays in the page header behind the drawer */}
          <div className="flex h-14 shrink-0 items-center justify-end border-b border-border/70 px-4">
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

/** GandalNexus orbite mark — orange planet + tilted orbit; the strokes and
 * satellite follow currentColor, so the mark adapts to dark and light themes. */
export function OrbitMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="GandalNexus">
      <ellipse cx="256" cy="258" rx="200" ry="72" fill="none" stroke="currentColor" strokeWidth="15" transform="rotate(-24 256 258)" />
      <circle cx="256" cy="258" r="112" fill="#F7931A" />
      <path
        d="M 440.8 192.1 L 438.6 201.7 L 434.0 212.1 L 427.1 223.0 L 418.0 234.4 L 406.8 246.1 L 393.7 257.9 L 378.9 269.8 L 362.4 281.5 L 344.6 292.8 L 325.6 303.8 L 305.8 314.1 L 285.3 323.8 L 264.4 332.6 L 243.4 340.4 L 222.6 347.2 L 202.2 352.8 L 182.5 357.2 L 163.8 360.3 L 146.2 362.1 L 130.1 362.6 L 115.5 361.7 L 102.8 359.5 L 92.0 356.0 L 83.4 351.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <circle cx="393.3" cy="154" r="16" fill="currentColor" />
    </svg>
  );
}

/** Brand block: lab logo + « Lab » pill (Stellar signature). */
export function BrandMark({
  responsive = false,
  pill = true,
}: {
  responsive?: boolean;
  /** Pastille « Lab ». */
  pill?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <OrbitMark className="h-8 w-8 shrink-0 text-foreground" />
      {pill ? (
        /* responsive : pastille masquée sous 400 px — l'icône seule suffit
            dans l'en-tête mobile, sinon la barre déborde. */
        <span
          className={cn(
            'rounded-full border border-primary/40 bg-primary/10 px-2 py-px text-[11px] font-medium text-primary',
            responsive && 'hidden min-[400px]:inline-block',
          )}
        >
          Lab
        </span>
      ) : null}
    </div>
  );
}
