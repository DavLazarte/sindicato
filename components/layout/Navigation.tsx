'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV_ITEMS: Record<string, { label: string; icon: string; href: string }[]> = {
  socio: [
    { label: 'Inicio', icon: '🏠', href: '/socio' },
    { label: 'Historial', icon: '📋', href: '/socio/historial' },
    { label: 'Perfil', icon: '👤', href: '/socio/perfil' },
  ],
  prestador: [
    { label: 'Inicio', icon: '🏠', href: '/prestador' },
    { label: 'Cobrar', icon: '💳', href: '/prestador/cobrar' },
    { label: 'Historial', icon: '📋', href: '/prestador/historial' },
  ],
  admin: [
    { label: 'Panel', icon: '📊', href: '/admin' },
    { label: 'Socios', icon: '👥', href: '/admin/socios' },
    { label: 'Negocios', icon: '🏪', href: '/admin/prestadores' },
    { label: 'Créditos', icon: '💰', href: '/admin/acreditaciones' },
    { label: 'Ventas', icon: '🧾', href: '/admin/transacciones' },
    { label: 'Config', icon: '⚙️', href: '/admin/configuracion' },
  ],
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const items = NAV_ITEMS[user.role] || [];

  return (
    <aside className="hidden md:flex w-64 bg-slate-900 flex-col shrink-0 shadow-2xl">
      <div className="p-6 border-b border-white/10 flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl p-2 mb-2 shadow-lg shadow-black/20">
          <img src="/logo-soem.png" alt="SOEM" className="w-16 h-16 object-contain" />
        </div>
        <div className="text-emerald-400 text-xs font-semibold mt-1 uppercase tracking-wider text-center">
          Sistema de beneficios
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 pt-4 text-slate-500 text-[11px] tracking-widest uppercase font-bold">
          Menú
        </div>
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== `/${user.role}` && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 translate-x-1'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-5 border-t border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
            {user.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold truncate">{user.name}</div>
            <div className="text-slate-500 text-xs capitalize">{user.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/50"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const items = NAV_ITEMS[user.role] || [];
  // On mobile, limit to 4 items max for bottom nav
  const mobileItems = items.slice(0, 4);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {mobileItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== `/${user.role}` && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-all min-w-0 ${
                isActive ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
              <span className="text-[10px] font-bold truncate">{item.label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-emerald-500 mt-0.5" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBar({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const { logout } = useAuth();
  return (
    <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 md:py-5 flex items-center justify-between gap-4 shrink-0">
      <div>
        {subtitle && <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{subtitle}</div>}
        <h1 className="text-lg md:text-xl font-bold text-slate-800">{title}</h1>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {action && <div>{action}</div>}
        <button 
          onClick={logout} 
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 focus:outline-none"
          title="Cerrar sesión"
        >
          <span className="text-lg">👋</span>
        </button>
      </div>
    </div>
  );
}
