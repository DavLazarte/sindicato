'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, DashboardPrestador, Transaccion } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function formatDate(date: string) { return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }); }

export default function PrestadorDashboard() {
  const [data, setData] = useState<DashboardPrestador | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<DashboardPrestador>>('/prestador/dashboard')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <>
      <TopBar title="Mi negocio" subtitle="Panel del prestador" action={
        <a href="/prestador/cobrar" className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center gap-2">
          <span>💳</span> Cobrar
        </a>
      } />
      <div className="p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Columna Izquierda: Stats */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-center items-center text-center">
              <p className="text-sm text-slate-500 font-medium mb-2 uppercase tracking-wider">Cobrado este mes</p>
              <p className="text-4xl sm:text-5xl font-black text-emerald-600 mb-2">{formatMoney(data?.total_cobrado || 0)}</p>
              <span className="bg-emerald-50 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full">Saldo actual</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm text-center">
                <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Ventas del mes</p>
                <p className="text-2xl font-black text-slate-800">{data?.cantidad_transacciones || 0}</p>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm text-center">
                <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Promedio / venta</p>
                <p className="text-2xl font-black text-slate-800">
                  {data && data.cantidad_transacciones > 0 ? formatMoney(data.total_cobrado / data.cantidad_transacciones) : '$0'}
                </p>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Últimas Ventas */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm h-full">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">Últimas ventas</h2>
                <a href="/prestador/historial" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Ver historial →</a>
              </div>
              <div className="divide-y divide-slate-50">
                {(!data?.transacciones || data.transacciones.length === 0) && (
                  <div className="p-12 text-center">
                    <span className="text-4xl block mb-3">📦</span>
                    <p className="text-slate-400 text-sm">Sin ventas registradas</p>
                  </div>
                )}
                {data?.transacciones?.slice(0, 5).map((t: Transaccion) => (
                  <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-lg shrink-0">💰</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{t.socio?.nombre} {t.socio?.apellido}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Legajo: {t.socio?.legajo} · {formatDate(t.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-600">+{formatMoney(t.monto_total)}</p>
                      {t.es_cuotas && <p className="text-[10px] text-blue-500 font-bold mt-0.5">Cuotas</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fila Inferior: Cuotas Pendientes y Cobradas */}
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
            
            {/* Cuotas Pendientes */}
            <div className="bg-white rounded-3xl border border-amber-200 shadow-sm h-full overflow-hidden flex flex-col max-h-[400px]">
              <div className="p-5 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
                <h2 className="text-base font-bold text-amber-800 flex items-center gap-2"><span>⏳</span> Cuotas a cobrar</h2>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {(!data?.cuotas_pendientes || data.cuotas_pendientes.length === 0) && (
                  <div className="p-12 text-center text-slate-400 text-sm">No hay cuotas pendientes a cobrar</div>
                )}
                {data?.cuotas_pendientes?.map(cuota => (
                  <div key={cuota.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-lg shrink-0">🗓️</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{cuota.transaccion?.socio?.nombre} {cuota.transaccion?.socio?.apellido}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Legajo: {cuota.transaccion?.socio?.legajo} · Mes: <span className="font-bold capitalize">{cuota.periodo?.nombre}</span></p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-amber-600">{formatMoney(cuota.monto)}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Cuota {cuota.nro_cuota}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cuotas Descontadas */}
            <div className="bg-white rounded-3xl border border-blue-200 shadow-sm h-full overflow-hidden flex flex-col max-h-[400px]">
              <div className="p-5 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
                <h2 className="text-base font-bold text-blue-800 flex items-center gap-2"><span>✅</span> Cuotas cobradas (últimos mov.)</h2>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {(!data?.cuotas_cobradas || data.cuotas_cobradas.length === 0) && (
                  <div className="p-12 text-center text-slate-400 text-sm">No hay cuotas cobradas recientemente</div>
                )}
                {data?.cuotas_cobradas?.map(cuota => (
                  <div key={cuota.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-lg shrink-0">💸</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{cuota.transaccion?.socio?.nombre} {cuota.transaccion?.socio?.apellido}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Cobrada el {new Date(cuota.cobrada_en || '').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-blue-600">+{formatMoney(cuota.monto)}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Cuota {cuota.nro_cuota}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
