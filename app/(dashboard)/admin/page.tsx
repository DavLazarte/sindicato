'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import Link from 'next/link';
import type { ApiResponse, DashboardAdmin } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }

const QUICK_ACTIONS = [
  { label: 'Socios', icon: '👥', href: '/admin/socios', color: 'bg-blue-50 text-blue-600' },
  { label: 'Negocios', icon: '🏪', href: '/admin/prestadores', color: 'bg-purple-50 text-purple-600' },
  { label: 'Acreditar', icon: '💰', href: '/admin/acreditaciones', color: 'bg-emerald-50 text-emerald-600' },
  { label: 'Ventas', icon: '🧾', href: '/admin/transacciones', color: 'bg-amber-50 text-amber-600' },
];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<DashboardAdmin>>('/admin/dashboard')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <>
      <TopBar title="Panel de control" subtitle="Administración" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-1">Total socios</p>
            <p className="text-3xl font-black text-indigo-600">{data?.total_socios || 0}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-1">Prestadores</p>
            <p className="text-3xl font-black text-purple-600">{data?.total_prestadores || 0}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-1">Saldo en circulación</p>
            <p className="text-2xl font-black text-emerald-600">{formatMoney(data?.total_saldo_circulacion || 0)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-1">Ventas del mes</p>
            <p className="text-3xl font-black text-slate-800">{data?.transacciones_mes_cantidad || 0}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">{formatMoney(data?.transacciones_mes_monto || 0)}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Accesos rápidos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className={`w-12 h-12 rounded-2xl ${a.color} flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform`}>{a.icon}</div>
                <p className="text-sm font-bold text-slate-800">{a.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
