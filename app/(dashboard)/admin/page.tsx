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


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mt-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-800 mb-4">Accesos rápidos</h2>
            <div className="grid grid-cols-2 gap-4">
              {QUICK_ACTIONS.map((a) => (
                <Link key={a.href} href={a.href} className="bg-slate-50 rounded-2xl border border-slate-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <div className={`w-10 h-10 rounded-xl ${a.color} flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform`}>{a.icon}</div>
                  <p className="text-sm font-bold text-slate-800">{a.label}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Últimas Acreditaciones */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[400px]">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Últimas acreditaciones</h3>
              <Link href="/admin/acreditaciones" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Ver todas →</Link>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {(!data?.ultimas_acreditaciones || data.ultimas_acreditaciones.length === 0) ? (
                <div className="p-12 text-center"><p className="text-slate-400 text-sm">No hay acreditaciones recientes</p></div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {data.ultimas_acreditaciones.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-lg shrink-0">💰</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {a.socio ? `${a.socio.nombre} ${a.socio.apellido}` : 'Acreditación'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(a.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-emerald-600">+{formatMoney(a.monto)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
