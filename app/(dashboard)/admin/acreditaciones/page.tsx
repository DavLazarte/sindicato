'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Acreditacion, Socio } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function formatDate(date: string) { return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default function AdminAcreditaciones() {
  // Acreditaciones history state
  const [acreditaciones, setAcreditaciones] = useState<Acreditacion[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Form & Selection state
  const [monto, setMonto] = useState('');
  const [procesando, setProcesando] = useState(false);
  
  // Socios list state
  const [socios, setSocios] = useState<Socio[]>([]);
  const [search, setSearch] = useState('');
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Fetch History
  const fetchHistory = useCallback((p: number) => {
    setLoadingHistory(true);
    api.get<ApiResponse<PaginatedData<Acreditacion>>>(`/admin/acreditaciones?page=${p}`)
      .then((res) => { setAcreditaciones(res.data.data); setPage(res.data.current_page); setLastPage(res.data.last_page); })
      .finally(() => setLoadingHistory(false));
  }, []);

  // Fetch Socios (Unpaginated for easy selection)
  const fetchSocios = useCallback(() => {
    setLoadingSocios(true);
    api.get<ApiResponse<Socio[]>>(`/admin/socios?unpaginated=true${search ? `&search=${search}` : ''}`)
      .then((res) => { 
        // Solo mostramos socios activos para acreditar
        setSocios(res.data.filter(s => s.estado === 'activo')); 
      })
      .finally(() => setLoadingSocios(false));
  }, [search]);

  // Initial load
  useEffect(() => { 
    fetchHistory(1); 
  }, [fetchHistory]);

  // Debounced search for Socios
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSocios();
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchSocios]);

  // Selection handlers
  const toggleSocio = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === socios.length) {
      setSelectedIds(newSet => {
        const temp = new Set(newSet);
        socios.forEach(s => temp.delete(s.id));
        return temp;
      });
    } else {
      setSelectedIds(newSet => {
        const temp = new Set(newSet);
        socios.forEach(s => temp.add(s.id));
        return temp;
      });
    }
  };

  const allSelectedInView = socios.length > 0 && socios.every(s => selectedIds.has(s.id));

  // Submit
  const handleAcreditar = async () => {
    const m = parseFloat(monto);
    if (!m || m <= 0) return;
    if (selectedIds.size === 0) return;

    if (!confirm(`¿Estás seguro de acreditar ${formatMoney(m)} a los ${selectedIds.size} socios seleccionados? Esta acción no se puede deshacer.`)) return;

    setProcesando(true);
    try {
      const res = await api.post<{ success: boolean; data: { socios_acreditados: number; monto: number } }>('/admin/acreditaciones/masiva', { 
        monto: m,
        socio_ids: Array.from(selectedIds)
      });
      alert(`✅ Acreditación exitosa. Se acreditó ${formatMoney(res.data.monto)} a ${res.data.socios_acreditados} socios.`);
      setMonto('');
      setSelectedIds(new Set());
      fetchHistory(1);
      fetchSocios();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al acreditar');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <>
      <TopBar title="Acreditaciones" subtitle="Asignación de saldo" />
      <div className="p-4 md:p-6 space-y-6">
        
        {/* Panel Superior: Selección de Monto y Botón */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-500 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-emerald-500/20 sticky top-4 z-10">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-black mb-1">Acreditación de saldo</h2>
              <p className="text-emerald-100 text-sm">
                Seleccioná los socios de la lista y asigná el monto a acreditar.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
              <div className="relative w-full sm:w-48">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-800 font-bold text-xl">$</span>
                <input 
                  type="number" 
                  value={monto} 
                  onChange={(e) => setMonto(e.target.value)} 
                  placeholder="Monto" 
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white text-emerald-900 text-xl font-black outline-none focus:ring-4 focus:ring-emerald-300 transition-all placeholder-emerald-300/50"
                />
              </div>
              <button 
                onClick={handleAcreditar} 
                disabled={procesando || !monto || parseFloat(monto) <= 0 || selectedIds.size === 0}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-900/20 whitespace-nowrap flex items-center justify-center gap-2"
              >
                {procesando ? 'Procesando...' : `Acreditar a ${selectedIds.size} socio(s)`}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Columna Izquierda: Selección de Socios */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 mb-4">Seleccionar Socios</h3>
              <input 
                type="text" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Buscar por nombre o legajo..." 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" 
              />
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingSocios ? (
                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
              ) : socios.length === 0 ? (
                <div className="p-12 text-center"><p className="text-slate-400 text-sm">No se encontraron socios activos.</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input 
                          type="checkbox" 
                          checked={allSelectedInView}
                          onChange={toggleAll}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="text-left px-2 py-3 font-bold text-slate-500 text-xs uppercase">Legajo</th>
                      <th className="text-left px-2 py-3 font-bold text-slate-500 text-xs uppercase">Socio</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase">Saldo actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {socios.map((s) => (
                      <tr key={s.id} onClick={() => toggleSocio(s.id)} className={`transition-colors cursor-pointer ${selectedIds.has(s.id) ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(s.id)}
                            readOnly
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                          />
                        </td>
                        <td className="px-2 py-3 font-mono font-bold text-slate-600 text-xs">{s.legajo}</td>
                        <td className="px-2 py-3 font-semibold text-slate-800">{s.nombre} {s.apellido}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(s.saldo_disponible)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 text-center">
              {socios.length} socio(s) en la lista actual
            </div>
          </div>

          {/* Columna Derecha: Historial */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Historial reciente</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingHistory ? (
                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
              ) : acreditaciones.length === 0 ? (
                <div className="p-12 text-center"><p className="text-slate-400 text-sm">No hay acreditaciones registradas</p></div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {acreditaciones.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-lg shrink-0">💰</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {a.socio ? `${a.socio.nombre} ${a.socio.apellido}` : 'Acreditación'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(a.created_at)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-emerald-600">+{formatMoney(a.monto)}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">{a.estado}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {lastPage > 1 && (
              <div className="p-4 border-t border-slate-100 flex justify-center gap-2 bg-white sticky bottom-0">
                <button disabled={page <= 1} onClick={() => fetchHistory(page - 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-colors">Anterior</button>
                <span className="px-4 py-2 text-sm text-slate-500 flex items-center">{page} / {lastPage}</span>
                <button disabled={page >= lastPage} onClick={() => fetchHistory(page + 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-colors">Siguiente</button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
