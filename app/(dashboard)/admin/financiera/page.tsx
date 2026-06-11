'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Socio, Prestamo } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function formatDate(date: string) { return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }); }

export default function AdminFinanciera() {
  // === ESTADO CREACIÓN ===
  const [legajoBuscado, setLegajoBuscado] = useState('');
  const [sociosEncontrados, setSociosEncontrados] = useState<Socio[]>([]);
  const [buscandoSocios, setBuscandoSocios] = useState(false);
  const [socioSeleccionado, setSocioSeleccionado] = useState<Socio | null>(null);

  const [montoTotal, setMontoTotal] = useState('');
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [observaciones, setObservaciones] = useState('');
  const [creando, setCreando] = useState(false);

  // === ESTADO LISTA ===
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [searchLista, setSearchLista] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState(''); // '' | 'vigente' | 'finalizado' | 'cancelado'
  const [cargandoLista, setCargandoLista] = useState(true);

  // === CARGA DE LISTA ===
  const fetchPrestamos = useCallback((p: number) => {
    setCargandoLista(true);
    let url = `/admin/prestamos?page=${p}`;
    if (searchLista) url += `&search=${searchLista}`;
    if (estadoFiltro) url += `&estado=${estadoFiltro}`;

    api.get<ApiResponse<PaginatedData<Prestamo>>>(url)
      .then((res) => {
        setPrestamos(res.data.data);
        setPage(res.data.current_page);
        setLastPage(res.data.last_page);
      })
      .finally(() => setCargandoLista(false));
  }, [searchLista, estadoFiltro]);

  useEffect(() => {
    const timer = setTimeout(() => fetchPrestamos(1), 400);
    return () => clearTimeout(timer);
  }, [searchLista, estadoFiltro, fetchPrestamos]);

  // === BÚSQUEDA SOCIO ===
  useEffect(() => {
    if (!legajoBuscado || legajoBuscado.length < 2) {
      setSociosEncontrados([]);
      return;
    }
    const timer = setTimeout(() => {
      setBuscandoSocios(true);
      api.get<ApiResponse<Socio[]>>(`/admin/socios?unpaginated=true&search=${legajoBuscado}`)
        .then(res => setSociosEncontrados(res.data))
        .finally(() => setBuscandoSocios(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [legajoBuscado]);

  const seleccionarSocio = (s: Socio) => {
    setSocioSeleccionado(s);
    setLegajoBuscado('');
    setSociosEncontrados([]);
  };

  // === CREAR PRÉSTAMO ===
  const handleCrear = async () => {
    if (!socioSeleccionado) return alert('Seleccione un socio');
    const m = parseFloat(montoTotal);
    if (!m || m <= 0) return alert('Monto inválido');

    if (!confirm(`¿Crear préstamo de ${formatMoney(m)} en ${cantidadCuotas} cuota(s) para ${socioSeleccionado.nombre} ${socioSeleccionado.apellido}?`)) return;

    setCreando(true);
    try {
      await api.post('/admin/prestamos', {
        socio_id: socioSeleccionado.id,
        monto_total: m,
        cantidad_cuotas: cantidadCuotas,
        observaciones
      });
      alert('✅ Préstamo creado exitosamente');
      setSocioSeleccionado(null);
      setMontoTotal('');
      setCantidadCuotas(1);
      setObservaciones('');
      fetchPrestamos(1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al crear préstamo');
    } finally {
      setCreando(false);
    }
  };

  // === ACCIONES PRÉSTAMO ===
  const handleToggleCuota = async (cuotaId: number) => {
    try {
      await api.post(`/admin/prestamos/cuotas/${cuotaId}/toggle`);
      fetchPrestamos(page);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado de la cuota');
    }
  };

  const handleCancelarPrestamo = async (id: number) => {
    if (!confirm('¿Estás seguro de cancelar este préstamo? Las cuotas pendientes serán anuladas.')) return;
    try {
      await api.delete(`/admin/prestamos/${id}`);
      fetchPrestamos(page);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al cancelar préstamo');
    }
  };

  return (
    <>
      <TopBar title="Financiera" subtitle="Gestión de préstamos" />
      <div className="p-4 md:p-6 space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6 items-start">
          
          {/* PANEL IZQUIERDO: NUEVO PRÉSTAMO */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sticky top-4">
            <h2 className="text-lg font-black text-slate-800 mb-5 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">💰</span>
              Nuevo Préstamo
            </h2>

            <div className="space-y-5">
              {/* Buscador Socio */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Socio</label>
                {socioSeleccionado ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-emerald-900">{socioSeleccionado.nombre} {socioSeleccionado.apellido}</p>
                      <p className="text-xs font-mono text-emerald-600">{socioSeleccionado.legajo}</p>
                    </div>
                    <button onClick={() => setSocioSeleccionado(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-emerald-200/50 text-emerald-700 transition-colors">✕</button>
                  </div>
                ) : (
                  <div>
                    <input 
                      type="text" 
                      value={legajoBuscado} 
                      onChange={(e) => setLegajoBuscado(e.target.value)} 
                      placeholder="Buscar legajo o nombre..." 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                    {/* Resultados búsqueda */}
                    {sociosEncontrados.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {sociosEncontrados.map(s => (
                          <div 
                            key={s.id} 
                            onClick={() => seleccionarSocio(s)}
                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                          >
                            <p className="text-sm font-bold text-slate-800">{s.nombre} {s.apellido}</p>
                            <p className="text-xs text-slate-500 font-mono">{s.legajo}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {buscandoSocios && <p className="text-xs text-emerald-600 mt-1">Buscando...</p>}
                  </div>
                )}
              </div>

              {/* Monto y Cuotas */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Monto total a devolver</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    type="number" 
                    value={montoTotal} 
                    onChange={(e) => setMontoTotal(e.target.value)} 
                    placeholder="0" 
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-base font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cuotas</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(n => (
                    <button 
                      key={n}
                      onClick={() => setCantidadCuotas(n)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${cantidadCuotas === n ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumen */}
              {montoTotal && parseFloat(montoTotal) > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex justify-between items-center">
                  <span className="text-sm text-slate-500">Monto por cuota:</span>
                  <span className="text-lg font-black text-slate-800">{formatMoney(parseFloat(montoTotal) / cantidadCuotas)}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Observaciones (Opcional)</label>
                <textarea 
                  value={observaciones} 
                  onChange={(e) => setObservaciones(e.target.value)} 
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                />
              </div>

              <button 
                onClick={handleCrear}
                disabled={creando || !socioSeleccionado || !montoTotal || parseFloat(montoTotal) <= 0}
                className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-40 transition-all shadow-lg shadow-slate-900/20"
              >
                {creando ? 'Creando...' : 'Crear Préstamo'}
              </button>
            </div>
          </div>

          {/* PANEL DERECHO: LISTA */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-6 min-h-[600px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-black text-slate-800">Préstamos Registrados</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  value={searchLista} 
                  onChange={(e) => setSearchLista(e.target.value)} 
                  placeholder="Buscar socio..." 
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 w-full sm:w-48"
                />
                <select 
                  value={estadoFiltro} 
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 text-slate-700 w-full sm:w-auto"
                >
                  <option value="">Todos los estados</option>
                  <option value="vigente">Vigentes</option>
                  <option value="finalizado">Finalizados</option>
                  <option value="cancelado">Cancelados</option>
                </select>
              </div>
            </div>

            {cargandoLista ? (
              <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
            ) : prestamos.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No hay préstamos registrados</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap">Socio</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap">Fecha</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap text-right">Total</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap text-center">Estado</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap min-w-[200px]">Cuotas</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prestamos.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        {/* Socio */}
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800 whitespace-nowrap">{p.socio?.nombre} {p.socio?.apellido}</p>
                          <p className="text-[10px] font-mono text-slate-500">{p.socio?.legajo}</p>
                        </td>
                        
                        {/* Fecha */}
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {formatDate(p.created_at)}
                        </td>
                        
                        {/* Total */}
                        <td className="px-4 py-3 text-right">
                          <p className="font-black text-slate-800">{formatMoney(p.monto_total)}</p>
                        </td>
                        
                        {/* Estado */}
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${
                            p.estado === 'vigente' ? 'bg-amber-100 text-amber-700' :
                            p.estado === 'finalizado' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {p.estado}
                          </span>
                        </td>
                        
                        {/* Cuotas */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.cuotas_prestamo?.map(cuota => (
                              <button
                                key={cuota.id}
                                onClick={() => handleToggleCuota(cuota.id)}
                                disabled={cuota.estado === 'anulada'}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                  cuota.estado === 'pagada' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                                  cuota.estado === 'anulada' ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' :
                                  'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                                title={`Cuota ${cuota.nro_cuota}: ${formatMoney(cuota.monto)} (${cuota.periodo?.nombre || 'Sin mes'})`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${cuota.estado === 'pagada' ? 'bg-emerald-500' : cuota.estado === 'anulada' ? 'bg-slate-300' : 'bg-slate-300'}`} />
                                C{cuota.nro_cuota}
                              </button>
                            ))}
                          </div>
                        </td>
                        
                        {/* Acciones */}
                        <td className="px-4 py-3 text-right">
                          {p.estado === 'vigente' ? (
                            <button 
                              onClick={() => handleCancelarPrestamo(p.id)} 
                              className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1"
                            >
                              Cancelar
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {lastPage > 1 && (
              <div className="flex justify-center gap-2 pt-6">
                <button disabled={page <= 1} onClick={() => fetchPrestamos(page - 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-100 transition-colors">Anterior</button>
                <span className="px-4 py-2 text-sm text-slate-500 flex items-center">{page} / {lastPage}</span>
                <button disabled={page >= lastPage} onClick={() => fetchPrestamos(page + 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-100 transition-colors">Siguiente</button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
