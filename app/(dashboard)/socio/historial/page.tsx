'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Movimiento } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function formatDate(date: string) { return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }); }

export default function SocioHistorial() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = (p: number) => {
    setLoading(true);
    api.get<ApiResponse<PaginatedData<Movimiento>>>(`/socio/movimientos?page=${p}`)
      .then((res) => {
        setMovimientos(res.data.data);
        setPage(res.data.current_page);
        setLastPage(res.data.last_page);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(1); }, []);

  return (
    <>
      <TopBar title="Historial completo" subtitle="Tus movimientos" />
      <div className="p-4 md:p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : movimientos.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl block mb-3">📋</span>
              <p className="text-slate-400 text-sm">No hay movimientos registrados</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {movimientos.map((mov) => {
                const isAnulada = mov.estado === 'anulada';
                const isPositive = mov.signo === '+';

                return (
                  <div key={mov.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                      isAnulada ? 'bg-slate-100' : isPositive ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                      {isAnulada ? '❌' : isPositive ? '💰' : '🛒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{mov.titulo}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(mov.fecha)}</p>
                      {mov.detalle && <p className="text-[11px] mt-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg inline-block">📝 {mov.detalle}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isAnulada ? 'text-slate-400 line-through' : isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {mov.signo}{formatMoney(mov.monto)}
                      </p>
                      {mov.estado && mov.estado !== 'completado' && mov.estado !== 'confirmada' && mov.estado !== 'cobrada' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                          isAnulada ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'
                        }`}>{mov.estado}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Pagination */}
          {lastPage > 1 && (
            <div className="p-4 border-t border-slate-100 flex justify-center gap-2">
              <button disabled={page <= 1} onClick={() => fetchData(page - 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-colors">Anterior</button>
              <span className="px-4 py-2 text-sm text-slate-500">{page} / {lastPage}</span>
              <button disabled={page >= lastPage} onClick={() => fetchData(page + 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-colors">Siguiente</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
