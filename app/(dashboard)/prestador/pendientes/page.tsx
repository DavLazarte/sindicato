'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Socio } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }

type Periodo = { id: number; nombre: string };
type CuotaPendiente = {
  id: number;
  nro_cuota: number;
  monto: number;
  estado: string;
  transaccion: {
    socio: Socio;
  };
  periodo: Periodo;
};

export default function PrestadorCuotasPendientes() {
  const [cuotas, setCuotas] = useState<CuotaPendiente[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<{ message: string; cobradas: number; fallidas: number } | null>(null);

  const fetchCuotas = useCallback((p: number) => {
    setLoading(true);
    api.get<ApiResponse<PaginatedData<CuotaPendiente>>>(`/prestador/cuotas/pendientes?page=${p}${search ? `&search=${search}` : ''}`)
      .then(res => {
        setCuotas(res.data.data);
        setPage(res.data.current_page);
        setLastPage(res.data.last_page);
      })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchCuotas(1), 400);
    return () => clearTimeout(t);
  }, [search, fetchCuotas]);

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === cuotas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cuotas.map(c => c.id)));
    }
  };

  const handleCobroMasivo = async () => {
    if (selectedIds.size === 0) return;
    setProcesando(true);
    setResultado(null);
    try {
      const res = await api.post<ApiResponse<{ message: string; cobradas: number; fallidas: number }>>('/prestador/cuotas/cobrar-masivo', {
        cuota_ids: Array.from(selectedIds)
      });
      setResultado(res.data as any);
      setSelectedIds(new Set());
      fetchCuotas(page); // refetch current page
    } catch (err: any) {
      alert(err?.message || 'Error al procesar el cobro masivo.');
    } finally {
      setProcesando(false);
    }
  };

  const totalSeleccionado = cuotas
    .filter(c => selectedIds.has(c.id))
    .reduce((sum, c) => sum + parseFloat(c.monto as any), 0);

  return (
    <>
      <TopBar title="Cuotas pendientes" subtitle="Cobro manual" />
      <div className="p-4 md:p-6 space-y-6">

        {resultado && (
          <div className={`rounded-2xl p-4 border ${resultado.fallidas > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className={`text-sm font-medium ${resultado.fallidas > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              {resultado.message}
            </p>
            <button onClick={() => setResultado(null)} className="text-xs underline mt-2 text-slate-500 hover:text-slate-700">Ocultar</button>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedIds(new Set()); }}
                placeholder="Buscar por legajo o nombre..."
                className="w-full md:w-72 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-emerald-500"
              />
            </div>
            
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <div className="text-sm font-semibold text-slate-600 hidden md:block">
                  {selectedIds.size} seleccionadas ({formatMoney(totalSeleccionado)})
                </div>
              )}
              <button
                onClick={handleCobroMasivo}
                disabled={selectedIds.size === 0 || procesando}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
              >
                {procesando ? 'Procesando...' : `Intentar cobro (${selectedIds.size})`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={cuotas.length > 0 && selectedIds.size === cuotas.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="p-4">Socio</th>
                  <th className="p-4">Legajo</th>
                  <th className="p-4">Período</th>
                  <th className="p-4">Cuota</th>
                  <th className="p-4 text-right">Monto</th>
                  <th className="p-4 text-center">Viabilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></td></tr>
                ) : cuotas.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">No se encontraron cuotas pendientes</td></tr>
                ) : (
                  cuotas.map(c => {
                    const socio = c.transaccion.socio;
                    const saldo = parseFloat(socio.saldo_disponible as any);
                    const monto = parseFloat(c.monto as any);
                    const tieneSaldo = saldo >= monto;
                    
                    return (
                      <tr key={c.id} className={`transition-colors ${selectedIds.has(c.id) ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="p-4 text-center">
                          <input 
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-800 text-sm">{socio.nombre} {socio.apellido}</div>
                        </td>
                        <td className="p-4 text-sm text-slate-600 font-medium">{socio.legajo}</td>
                        <td className="p-4 text-sm text-slate-600">{c.periodo.nombre}</td>
                        <td className="p-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs font-bold">
                            Nro {c.nro_cuota}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-slate-800">{formatMoney(monto)}</td>
                        <td className="p-4 text-center">
                          {tieneSaldo ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-xs font-bold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Con saldo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Sin saldo
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {lastPage > 1 && (
            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-sm text-slate-500">Página {page} de {lastPage}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => fetchCuotas(page - 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50">Anterior</button>
                <button disabled={page >= lastPage} onClick={() => fetchCuotas(page + 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50">Siguiente</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
