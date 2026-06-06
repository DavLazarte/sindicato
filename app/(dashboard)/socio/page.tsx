'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, DashboardSocio, Transaccion, Cuota } from '@/lib/types';

function formatMoney(n: number) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function SocioDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSocio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<DashboardSocio>>('/socio/dashboard')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <TopBar title={`Hola, ${data.nombre}`} subtitle="Tu billetera" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Hero Balance Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400 p-7 md:p-9 text-white shadow-xl shadow-emerald-500/20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="relative">
            <p className="text-emerald-100 text-sm font-semibold uppercase tracking-wider mb-2">Saldo disponible</p>
            <p className="text-5xl md:text-6xl font-black tracking-tight mb-4">{formatMoney(data.saldo_disponible)}</p>
            <div className="flex items-center gap-4 text-sm">
              <span className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full font-semibold">
                📋 {data.legajo}
              </span>
              <span className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full font-semibold capitalize">
                {data.estado === 'activo' ? '🟢' : '🔴'} {data.estado}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-1">Compras del mes</p>
            <p className="text-2xl font-bold text-slate-800">{data.transacciones?.length || 0}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium mb-1">Socio</p>
            <p className="text-lg font-bold text-slate-800 truncate">{data.nombre} {data.apellido}</p>
          </div>
        </div>

        {/* Pending Cuotas */}
        {data.cuotas_pendientes && data.cuotas_pendientes.length > 0 && (
          <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden mt-6 mb-6">
            <div className="p-5 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
              <h2 className="text-base font-bold text-amber-800 flex items-center gap-2">
                <span>⚠️</span> Cuotas Pendientes
              </h2>
            </div>
            <div className="divide-y divide-slate-50">
              {data.cuotas_pendientes.map((cuota: Cuota) => (
                <div key={cuota.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-lg shrink-0">
                    🗓️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {cuota.transaccion?.prestador?.nombre || 'Negocio'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vence en: <strong className="text-slate-700 capitalize">{cuota.periodo?.nombre}</strong> (Cuota {cuota.nro_cuota})
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-amber-600">
                      -{formatMoney(cuota.monto)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Últimos movimientos</h2>
            <a href="/socio/historial" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              Ver todo →
            </a>
          </div>
          <div className="divide-y divide-slate-50">
            {(!data.transacciones || data.transacciones.length === 0) && (
              <div className="p-8 text-center">
                <span className="text-4xl block mb-3">🛒</span>
                <p className="text-slate-400 text-sm">No tenés movimientos todavía</p>
              </div>
            )}
            {data.transacciones?.map((t: Transaccion) => {
              let displayAmount = formatMoney(t.monto_total);
              let subtext = null;
              const isAnulada = t.estado === 'anulada';

              if (t.es_cuotas && t.cuotas && t.cuotas.length > 0) {
                const cobradas = t.cuotas.filter(c => c.estado === 'cobrada');
                const montoCobrado = cobradas.reduce((acc, c) => acc + c.monto, 0);
                if (montoCobrado > 0) {
                  displayAmount = formatMoney(montoCobrado);
                  subtext = `Venta total: ${formatMoney(t.monto_total)}`;
                }
              }

              return (
                <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                    isAnulada ? 'bg-slate-100' : 'bg-red-50'
                  }`}>
                    {isAnulada ? '❌' : '🛒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {t.prestador?.nombre || 'Negocio'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(t.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${isAnulada ? 'text-slate-400 line-through' : 'text-red-500'}`}>
                      -{displayAmount}
                    </p>
                    {subtext && <p className="text-[10px] text-slate-500 font-medium mb-1">{subtext}</p>}
                    {t.es_cuotas && (
                      <p className="text-[10px] font-medium text-blue-500 mt-0.5">En cuotas</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
