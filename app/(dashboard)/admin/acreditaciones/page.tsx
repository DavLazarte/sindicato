'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, Socio } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }

export default function AdminAcreditaciones() {
  // Form & Selection state
  const [monto, setMonto] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [descontarCuotas, setDescontarCuotas] = useState(true);
  const [pisarSaldo, setPisarSaldo] = useState(false);
  
  // Socios list state
  const [socios, setSocios] = useState<Socio[]>([]);
  const [search, setSearch] = useState('');
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Derived state
  const sociosAutomaticos = socios.filter(s => s.deposito_automatico);
  const sociosRevision = socios.filter(s => !s.deposito_automatico);

  const [visibleAuto, setVisibleAuto] = useState(50);
  const [visibleRev, setVisibleRev] = useState(50);

  // Fetch Socios (Unpaginated for easy selection)
  const fetchSocios = useCallback(() => {
    setLoadingSocios(true);
    api.get<ApiResponse<Socio[]>>(`/admin/socios?unpaginated=true${search ? `&search=${search}` : ''}`)
      .then((res) => { 
        // Solo mostramos socios activos para acreditar
        const activeSocios = res.data.filter(s => s.estado === 'activo' && (!s.user || s.user.estado === 'activo'));
        setSocios(activeSocios); 
        
        // Auto-select automáticos
        if (!search) {
          const defaultSelected = new Set<number>();
          activeSocios.forEach(s => {
            if (s.deposito_automatico) defaultSelected.add(s.id);
          });
          setSelectedIds(defaultSelected);
        }
      })
      .finally(() => setLoadingSocios(false));
  }, [search]);

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

  const handleScrollAuto = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
    if (bottom && visibleAuto < sociosAutomaticos.length) {
      setVisibleAuto(prev => prev + 50);
    }
  };

  const handleScrollRev = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
    if (bottom && visibleRev < sociosRevision.length) {
      setVisibleRev(prev => prev + 50);
    }
  };

  const toggleAllAutomaticos = () => {
    const allAutoIds = sociosAutomaticos.map(s => s.id);
    const areAllSelected = allAutoIds.every(id => selectedIds.has(id));
    
    setSelectedIds(newSet => {
      const temp = new Set(newSet);
      if (areAllSelected) {
        allAutoIds.forEach(id => temp.delete(id));
      } else {
        allAutoIds.forEach(id => temp.add(id));
      }
      return temp;
    });
  };

  const toggleAllRevision = () => {
    const allRevIds = sociosRevision.map(s => s.id);
    const areAllSelected = allRevIds.every(id => selectedIds.has(id));
    
    setSelectedIds(newSet => {
      const temp = new Set(newSet);
      if (areAllSelected) {
        allRevIds.forEach(id => temp.delete(id));
      } else {
        allRevIds.forEach(id => temp.add(id));
      }
      return temp;
    });
  };

  const allAutoSelectedInView = sociosAutomaticos.length > 0 && sociosAutomaticos.every(s => selectedIds.has(s.id));
  const allRevSelectedInView = sociosRevision.length > 0 && sociosRevision.every(s => selectedIds.has(s.id));

  // Submit
  const handleAcreditar = async () => {
    const m = parseFloat(monto);
    if (!m || m <= 0) return;
    if (selectedIds.size === 0) return;

    if (!confirm(`¿Estás seguro de ${pisarSaldo ? 'PISAR el saldo y dejar en' : 'acreditar'} ${formatMoney(m)} a los ${selectedIds.size} socios seleccionados? Esta acción no se puede deshacer.`)) return;

    setProcesando(true);
    try {
      const res = await api.post<{ success: boolean; data: { socios_acreditados: number; monto: number; cuotas_cobradas: number } }>('/admin/acreditaciones/masiva', { 
        monto: m,
        socio_ids: Array.from(selectedIds),
        descontar_cuotas: descontarCuotas,
        pisar_saldo: pisarSaldo
      });
      alert(`✅ ${pisarSaldo ? 'Saldo pisado' : 'Acreditación'} exitosa. Se ${pisarSaldo ? 'fijó' : 'acreditó'} ${formatMoney(res.data.monto)} a ${res.data.socios_acreditados} socios. Se cobraron ${res.data.cuotas_cobradas} cuotas pendientes automáticamente.`);
      setMonto('');
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
                Seleccioná los socios de las listas y asigná el monto a acreditar.
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
          <div className="mt-4 flex flex-col md:flex-row items-center justify-end max-w-4xl mx-auto gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer bg-white/10 px-4 py-2.5 rounded-xl text-sm font-medium text-emerald-50 hover:bg-white/20 transition-colors border border-white/10 w-full md:w-auto">
              <input 
                type="checkbox" 
                checked={descontarCuotas} 
                onChange={(e) => setDescontarCuotas(e.target.checked)}
                className="w-5 h-5 rounded border-white/20 text-slate-900 focus:ring-white/50 bg-white/10"
              />
              <span>Descontar cuotas del período automáticamente</span>
            </label>
            <label className={`flex items-center gap-2.5 cursor-pointer px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border w-full md:w-auto ${
              pisarSaldo 
                ? 'bg-amber-400/30 border-amber-300/50 text-amber-100 hover:bg-amber-400/40' 
                : 'bg-white/10 border-white/10 text-emerald-50 hover:bg-white/20'
            }`}>
              <input 
                type="checkbox" 
                checked={pisarSaldo} 
                onChange={(e) => setPisarSaldo(e.target.checked)}
                className="w-5 h-5 rounded border-white/20 text-slate-900 focus:ring-white/50 bg-white/10"
              />
              <span>⚠️ Pisar saldo (reemplazar, no sumar)</span>
            </label>
          </div>
        </div>

        <div className="mb-4">
          <input 
            type="text" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Buscar por nombre o legajo en ambas listas..." 
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Columna Izquierda: Socios Automáticos */}
          <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-5 border-b border-emerald-100 bg-emerald-50">
              <h3 className="text-base font-bold text-emerald-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Depósito Automático
              </h3>
              <p className="text-xs text-emerald-600 mt-1">Estos socios reciben el depósito completo mensualmente.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto" onScroll={handleScrollAuto}>
              {loadingSocios ? (
                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
              ) : sociosAutomaticos.length === 0 ? (
                <div className="p-12 text-center"><p className="text-slate-400 text-sm">No se encontraron socios.</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input 
                          type="checkbox" 
                          checked={allAutoSelectedInView}
                          onChange={toggleAllAutomaticos}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          title="Seleccionar todos"
                        />
                      </th>
                      <th className="text-left px-2 py-3 font-bold text-slate-500 text-xs uppercase">Socio</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sociosAutomaticos.slice(0, visibleAuto).map((s) => (
                      <tr key={s.id} onClick={() => toggleSocio(s.id)} className={`transition-colors cursor-pointer ${selectedIds.has(s.id) ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(s.id)}
                            readOnly
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <p className="font-semibold text-slate-800">{s.nombre} {s.apellido}</p>
                          <p className="font-mono text-slate-500 text-[10px]">{s.legajo}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(s.saldo_disponible)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 text-center">
              {sociosAutomaticos.length} socio(s)
            </div>
          </div>

          {/* Columna Derecha: Socios en Revisión */}
          <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-5 border-b border-amber-100 bg-amber-50">
              <h3 className="text-base font-bold text-amber-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                En Revisión
              </h3>
              <p className="text-xs text-amber-600 mt-1">Socios que requieren revisar el monto a depositar.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto" onScroll={handleScrollRev}>
              {loadingSocios ? (
                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>
              ) : sociosRevision.length === 0 ? (
                <div className="p-12 text-center"><p className="text-slate-400 text-sm">No se encontraron socios.</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input 
                          type="checkbox" 
                          checked={allRevSelectedInView}
                          onChange={toggleAllRevision}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          title="Seleccionar todos"
                        />
                      </th>
                      <th className="text-left px-2 py-3 font-bold text-slate-500 text-xs uppercase">Socio</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sociosRevision.slice(0, visibleRev).map((s) => (
                      <tr key={s.id} onClick={() => toggleSocio(s.id)} className={`transition-colors cursor-pointer ${selectedIds.has(s.id) ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(s.id)}
                            readOnly
                            className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 pointer-events-none"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <p className="font-semibold text-slate-800">{s.nombre} {s.apellido}</p>
                          <p className="font-mono text-slate-500 text-[10px]">{s.legajo}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(s.saldo_disponible)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 text-center">
              {sociosRevision.length} socio(s)
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
