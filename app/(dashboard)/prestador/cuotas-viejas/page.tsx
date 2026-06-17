'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Socio, Transaccion } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function formatDate(d: string) { return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }); }

type SocioResult = { id: number; nombre_completo: string; legajo: string; saldo_disponible: number; estado: string };

export default function PrestadorCuotasViejas() {
  // ─── Form state ───────────────────────────────────────────────
  const [legajoBusq, setLegajoBusq] = useState('');
  const [socioResult, setSocioResult] = useState<SocioResult | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [socioError, setSocioError] = useState('');

  const [cantidadCuotas, setCantidadCuotas] = useState('');
  const [montoCuota, setMontoCuota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // ─── List state ───────────────────────────────────────────────
  const [cargas, setCargas] = useState<Transaccion[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCargas = useCallback((p: number) => {
    setLoading(true);
    api.get<ApiResponse<PaginatedData<Transaccion>>>(`/prestador/cuotas-viejas?page=${p}${search ? `&search=${search}` : ''}`)
      .then(res => { setCargas(res.data.data); setPage(res.data.current_page); setLastPage(res.data.last_page); })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchCargas(1), 400);
    return () => clearTimeout(t);
  }, [search, fetchCargas]);

  // ─── Buscar socio ─────────────────────────────────────────────
  const handleBuscarSocio = async () => {
    if (!legajoBusq.trim()) return;
    setBuscando(true);
    setSocioError('');
    setSocioResult(null);
    try {
      const res = await api.get<ApiResponse<SocioResult>>(`/prestador/socios/buscar?legajo=${legajoBusq.trim()}`);
      setSocioResult(res.data);
    } catch {
      setSocioError('Socio no encontrado. Verificá el legajo.');
    } finally {
      setBuscando(false);
    }
  };

  // ─── Guardar cuotas ───────────────────────────────────────────
  const handleGuardar = async () => {
    if (!socioResult) return alert('Primero buscá el socio.');
    const n = parseInt(cantidadCuotas);
    const m = parseFloat(montoCuota);
    if (!n || n < 1 || !m || m <= 0) return alert('Ingresá una cantidad y monto válidos.');

    setGuardando(true);
    try {
      await api.post('/prestador/cuotas-viejas', {
        socio_id: socioResult.id,
        cantidad_cuotas: n,
        monto_cuota: m,
      });
      setSuccessMsg(`✅ ${n} cuota${n > 1 ? 's' : ''} de ${formatMoney(m)} cargadas para ${socioResult.nombre_completo}. Se descontarán en las próximas acreditaciones.`);
      setSocioResult(null);
      setLegajoBusq('');
      setCantidadCuotas('');
      setMontoCuota('');
      fetchCargas(1);
    } catch (err: any) {
      alert(err?.message || 'Error al guardar las cuotas.');
    } finally {
      setGuardando(false);
    }
  };

  const montoTotal = parseInt(cantidadCuotas) > 0 && parseFloat(montoCuota) > 0
    ? parseInt(cantidadCuotas) * parseFloat(montoCuota)
    : 0;

  return (
    <>
      <TopBar title="Cuotas previas" subtitle="Carga de cuotas pendientes" />
      <div className="p-4 md:p-6 space-y-6">

        {/* ─── FORMULARIO DE CARGA ─── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">Cargar cuotas pendientes</h2>
            <p className="text-xs text-slate-500 mt-1">Para ventas anteriores al sistema. Las cuotas quedan pendientes y se descontarán en la próxima acreditación.</p>
          </div>
          <div className="p-5 space-y-5">
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-700 font-medium">
                {successMsg}
                <button onClick={() => setSuccessMsg('')} className="ml-2 text-emerald-500 underline text-xs">cerrar</button>
              </div>
            )}

            {/* Buscar socio */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Legajo del socio</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={legajoBusq}
                  onChange={e => { setLegajoBusq(e.target.value); setSocioResult(null); setSocioError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleBuscarSocio()}
                  placeholder="Ej: 7407"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleBuscarSocio}
                  disabled={buscando}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {buscando ? '...' : '🔍 Buscar'}
                </button>
              </div>
              {socioError && <p className="text-xs text-red-500 mt-1">{socioError}</p>}

              {socioResult && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {socioResult.nombre_completo.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-emerald-800">{socioResult.nombre_completo}</p>
                    <p className="text-xs text-emerald-600">Legajo {socioResult.legajo} · Saldo: {formatMoney(socioResult.saldo_disponible)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${socioResult.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {socioResult.estado}
                  </span>
                </div>
              )}
            </div>

            {/* Cantidad y monto */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Cantidad de cuotas</label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={cantidadCuotas}
                  onChange={e => setCantidadCuotas(e.target.value)}
                  placeholder="Ej: 3"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Monto por cuota</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={montoCuota}
                  onChange={e => setMontoCuota(e.target.value)}
                  placeholder="Ej: 1500"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Resumen */}
            {montoTotal > 0 && (
              <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total a descontar en {cantidadCuotas} meses:</span>
                  <span className="font-black text-slate-800 text-base">{formatMoney(montoTotal)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Se generarán {cantidadCuotas} cuotas de {formatMoney(parseFloat(montoCuota))} c/u, comenzando desde el período actual.
                </p>
              </div>
            )}

            <button
              onClick={handleGuardar}
              disabled={guardando || !socioResult || !cantidadCuotas || !montoCuota}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {guardando ? 'Cargando...' : '📂 Cargar cuotas pendientes'}
            </button>
          </div>
        </div>

        {/* ─── LISTA DE CARGAS ─── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-800">Cargas realizadas</h2>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar socio..."
              className="w-full sm:w-64 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          {loading ? (
            <div className="p-10 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
          ) : cargas.length === 0 ? (
            <div className="p-10 text-center"><span className="text-4xl block mb-2">📂</span><p className="text-slate-400 text-sm">No hay cargas manuales registradas</p></div>
          ) : (
            <div className="divide-y divide-slate-50">
              {cargas.map(t => (
                <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-lg shrink-0">📂</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{t.socio?.nombre} {t.socio?.apellido}</p>
                      <p className="text-xs text-slate-400">Legajo {t.socio?.legajo} · Cargado el {formatDate(t.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-slate-800">{formatMoney(t.monto_total)}</p>
                      <p className="text-xs text-slate-500">{t.cuotas?.length || 0} cuotas</p>
                    </div>
                  </div>
                  {t.cuotas && t.cuotas.length > 0 && (
                    <div className="mt-3 ml-13 flex flex-wrap gap-2">
                      {t.cuotas.map(c => (
                        <span key={c.id} className={`text-[10px] font-bold px-2 py-1 rounded-lg ${c.estado === 'cobrada' ? 'bg-emerald-50 text-emerald-600' : c.estado === 'anulada' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>
                          Cuota {c.nro_cuota}: {formatMoney(c.monto)} · {c.estado}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {lastPage > 1 && (
            <div className="p-4 border-t border-slate-100 flex justify-center gap-2">
              <button disabled={page <= 1} onClick={() => fetchCargas(page - 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200">Anterior</button>
              <span className="px-4 py-2 text-sm text-slate-500">{page} / {lastPage}</span>
              <button disabled={page >= lastPage} onClick={() => fetchCargas(page + 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200">Siguiente</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
