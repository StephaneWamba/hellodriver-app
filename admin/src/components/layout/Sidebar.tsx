import { NavLink } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  IconHome,
  IconShieldCheck,
  IconMap,
  IconRoute,
  IconWallet,
  IconUsers,
  IconGift,
  IconChat,
  IconSettings,
  IconLogout,
  IconChevronRight,
} from '@/components/ui/icons';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { useSidebarCollapsed } from './useSidebarCollapsed';

const NAV_SECTIONS = [
  {
    label: 'Opérations',
    items: [
      { to: '/', label: 'Tableau de bord', icon: IconHome, end: true },
      { to: '/chauffeurs', label: 'Vérification chauffeurs', icon: IconShieldCheck },
      { to: '/carte', label: 'Carte en direct', icon: IconMap },
      { to: '/courses', label: 'Courses & litiges', icon: IconRoute },
    ],
  },
  {
    label: 'Croissance',
    items: [
      { to: '/finances', label: 'Finances', icon: IconWallet },
      { to: '/utilisateurs', label: 'Utilisateurs', icon: IconUsers },
      { to: '/parrainage', label: 'Parrainage & promos', icon: IconGift },
      { to: '/agent', label: 'Agent WhatsApp', icon: IconChat },
    ],
  },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export function Sidebar() {
  const { user, logout } = useAuth();
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        'relative flex h-screen shrink-0 flex-col bg-ink-deep text-white/70 transition-[width] duration-200 ease-out',
        collapsed ? 'w-[76px]' : 'w-64'
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary opacity-[0.14] blur-[90px]" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-driver opacity-[0.16] blur-[100px]" />
      </div>

      <button
        onClick={toggle}
        title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
        className="absolute -right-3 top-6 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white text-muted shadow-card transition-all hover:text-ink hover:shadow-raised"
      >
        <IconChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', !collapsed && 'rotate-180')} />
      </button>

      <div className={cn('relative z-10 flex items-center gap-2.5 px-5 py-5', collapsed && 'justify-center px-0')}>
        <Logo size={34} />
        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap">
            <p className="font-display text-base font-semibold leading-tight text-white">HelloDriver</p>
            <p className="text-[11px] leading-tight text-white/40">Admin</p>
          </div>
        )}
      </div>

      <nav
        className={cn(
          'relative z-10 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin',
          collapsed ? 'flex flex-col justify-around px-2 py-6' : 'space-y-6 px-3 py-2'
        )}
      >
        {collapsed
          ? NAV_ITEMS.map((item) => (
              <Tooltip key={item.to} content={item.label}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/55 hover:bg-white/5 hover:text-white/85'
                    )
                  }
                >
                  <item.icon className="h-7 w-7 shrink-0" />
                </NavLink>
              </Tooltip>
            ))
          : NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/55 hover:bg-white/5 hover:text-white/85'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
      </nav>

      <div className={cn('relative z-10 border-t border-white/10 py-3', collapsed ? 'px-2' : 'px-3')}>
        <Tooltip content="Paramètres" disabled={!collapsed}>
          <NavLink
            to="/parametres"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-xl text-sm font-medium transition-colors',
                collapsed ? 'mx-auto h-11 w-11 justify-center' : 'px-3 py-2.5',
                isActive ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white/85'
              )
            }
          >
            <IconSettings className={collapsed ? 'h-7 w-7' : 'h-5 w-5'} />
            {!collapsed && 'Paramètres'}
          </NavLink>
        </Tooltip>

        {collapsed ? (
          <div className="mt-3 flex flex-col items-center gap-3">
            <Tooltip content={user?.name ?? 'Admin'} disabled={!collapsed}>
              <div>
                <Avatar firstName={user?.name?.split(' ')[0]} lastName={user?.name?.split(' ')[1]} size={36} />
              </div>
            </Tooltip>
            <Tooltip content="Se déconnecter" disabled={!collapsed}>
              <button
                onClick={logout}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <IconLogout className="h-[18px] w-[18px]" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5">
            <Avatar firstName={user?.name?.split(' ')[0]} lastName={user?.name?.split(' ')[1]} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name ?? 'Admin'}</p>
              <p className="truncate text-[11px] text-white/40">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              title="Se déconnecter"
            >
              <IconLogout className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
