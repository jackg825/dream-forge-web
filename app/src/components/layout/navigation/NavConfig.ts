import {
  LayoutDashboard,
  Wand2,
  Eye,
  History,
  Shield,
  Workflow,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  requireAuth?: boolean;
  showAlways?: boolean;
}

export interface NavSection {
  id: string;
  titleKey: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

// User navigation items (for UserHeader)
export const userNavItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, requireAuth: true },
  { href: '/generate', labelKey: 'nav.generate', icon: Wand2, showAlways: true },
  { href: '/preview', labelKey: 'nav.previewTool', icon: Eye, showAlways: true },
  { href: '/dashboard/history', labelKey: 'nav.history', icon: History, requireAuth: true },
];

// Admin navigation items (for AdminHeader)
export const adminNavItems: NavItem[] = [
  { href: '/admin', labelKey: 'admin.dashboard', icon: Shield },
  { href: '/admin/pipelines', labelKey: 'admin.pipelines', icon: Workflow },
];

// Mobile navigation sections for UserHeader
export const userMobileSections: NavSection[] = [
  {
    id: 'navigation',
    titleKey: 'mobile.navigation',
    items: userNavItems,
    defaultOpen: true,
  },
  {
    id: 'account',
    titleKey: 'mobile.account',
    items: [
      { href: '/settings', labelKey: 'nav.settings', icon: Settings, requireAuth: true },
    ],
    defaultOpen: false,
  },
];

// Mobile navigation sections for AdminHeader
export const adminMobileSections: NavSection[] = [
  {
    id: 'admin',
    titleKey: 'mobile.adminNavigation',
    items: adminNavItems,
    defaultOpen: true,
  },
];

// Helper: Check if current path matches (handles nested routes like /generate/*)
export function isActivePath(pathname: string, href: string): boolean {
  // Special case: /generate should match all /generate/* paths
  if (href === '/generate') {
    return pathname === '/generate' || pathname.startsWith('/generate/');
  }
  // Special case: /admin should only match exactly /admin, not /admin/pipelines
  if (href === '/admin') {
    return pathname === '/admin';
  }
  return pathname === href;
}

// Helper: Filter nav items based on auth state
export function filterNavItems(items: NavItem[], isAuthenticated: boolean): NavItem[] {
  return items.filter((item) => {
    if (item.requireAuth && !isAuthenticated) return false;
    if (!item.showAlways && !isAuthenticated) return false;
    return true;
  });
}
