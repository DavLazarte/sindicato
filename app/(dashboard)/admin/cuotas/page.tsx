'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Periodo, Cuota } from '@/lib/types';
import * as XLSX from 'xlsx-js-style';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function formatDate(date: string) { return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default function AdminCuotas() {
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [prestadorId, setPrestadorId] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [estado, setEstado] = useState('cobrada'); // Por defecto ver las cobradas
  
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [prestadores, setPrestadores] = useState<{id: number, nombre: string}[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<Periodo[]>>('/admin/periodos').then(res => setPeriodos(res.data || []));
    api.get<ApiResponse<any>>('/admin/prestadores?unpaginated=1').then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.data || [];
      setPrestadores(data);
    });
  }, []);

  const fetchData = useCallback((p: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.append('page', p.toString());
    if (search) params.append('search', search);
    if (periodoId) params.append('periodo_id', periodoId);
    if (prestadorId) params.append('prestador_id', prestadorId);
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    if (estado) params.append('estado', estado);

    api.get<ApiResponse<PaginatedData<Cuota>>>(`/admin/cuotas?${params.toString()}`)
      .then((res) => { setCuotas(res.data.data); setPage(res.data.current_page); setLastPage(res.data.last_page); })
      .finally(() => setLoading(false));
  }, [search, periodoId, prestadorId, fechaDesde, fechaHasta, estado]);

  useEffect(() => { 
    const timer = setTimeout(() => {
      fetchData(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, periodoId, prestadorId, fechaDesde, fechaHasta, estado, fetchData]);

  const handleExportar = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('unpaginated', '1');
      if (search) params.append('search', search);
      if (periodoId) params.append('periodo_id', periodoId);
      if (prestadorId) params.append('prestador_id', prestadorId);
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);
      if (estado) params.append('estado', estado);

      const res = await api.get<ApiResponse<any>>(`/admin/cuotas?${params.toString()}`);
      const data: Cuota[] = Array.isArray(res.data) ? res.data : res.data.data || [];
      
      const rows = data.map(c => ({
        "Fecha de Cobro": c.cobrada_en ? new Date(c.cobrada_en).toLocaleString('es-AR') : 'Pendiente',
        Socio: `${c.transaccion?.socio?.nombre} ${c.transaccion?.socio?.apellido}`,
        Legajo: c.transaccion?.socio?.legajo,
        Negocio: c.transaccion?.prestador?.nombre,
        "Nro Cuota": c.nro_cuota,
        "Período de Venta": c.periodo?.nombre || '-',
        Monto: c.monto,
        Estado: c.estado,
      }));

      const totalMonto = data.reduce((acc, c) => acc + Number(c.monto), 0);
      
      rows.push({
        "Fecha de Cobro": '', Socio: '', Legajo: '', Negocio: '', "Nro Cuota": 0, "Período de Venta": 'TOTAL', Monto: totalMonto, Estado: '' as any
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      
      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:H1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = { c: C, r: R };
          const cellRef = XLSX.utils.encode_cell(cellAddress);
          if (!ws[cellRef]) continue;
          
          ws[cellRef].s = {
            font: { name: "Arial", sz: 10 },
            alignment: { vertical: "center" }
          };

          if (R === 0) {
            ws[cellRef].s.font.bold = true;
            ws[cellRef].s.font.color = { rgb: "FFFFFF" };
            ws[cellRef].s.fill = { fgColor: { rgb: "475569" } };
            ws[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
          }
          
          if (R === range.e.r) {
            ws[cellRef].s.font.bold = true;
            ws[cellRef].s.fill = { fgColor: { rgb: "D1FAE5" } };
            if (C === 6) ws[cellRef].s.font.color = { rgb: "065F46" };
          }
        }
      }

      ws['!cols'] = [
        { wch: 20 }, // Fecha Cobro
        { wch: 30 }, // Socio
        { wch: 10 }, // Legajo
        { wch: 30 }, // Negocio
        { wch: 10 }, // Nro Cuota
        { wch: 20 }, // Período
        { wch: 15 }, // Monto
        { wch: 15 }, // Estado
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cuotas");
      XLSX.writeFile(wb, "Reporte_Cuotas.xlsx");

    } catch (err) {
      alert("Error al exportar los datos.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <TopBar title="Liquidación de Negocios" subtitle="Cuotas Cobradas" />
      <div className="p-4 md:p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <h2 className="text-lg font-black text-slate-800">Filtros de Liquidación</h2>
            <button 
              onClick={handleExportar}
              disabled={exporting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
            >
              {exporting ? 'Generando Excel...' : '📊 Exportar Liquidación'}
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1">Negocio a Liquidar</label>
              <select 
                value={prestadorId} 
                onChange={(e) => setPrestadorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none"
              >
                <option value="">Todos los negocios</option>
                {prestadores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Período de Venta</label>
              <select 
                value={periodoId} 
                onChange={(e) => setPeriodoId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none"
              >
                <option value="">Todos los meses</option>
                {periodos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Estado de Cuota</label>
              <select 
                value={estado} 
                onChange={(e) => setEstado(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none"
              >
                <option value="">Todos los estados</option>
                <option value="cobrada">Cobradas</option>
                <option value="pendiente">Pendientes</option>
                <option value="anulada">Anuladas</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Cobrado Desde</label>
              <input 
                type="date" 
                value={fechaDesde} 
                onChange={(e) => setFechaDesde(e.target.value)} 
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Cobrado Hasta</label>
              <input 
                type="date" 
                value={fechaHasta} 
                onChange={(e) => setFechaHasta(e.target.value)} 
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none" 
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800">Detalle de Cuotas</h2>
            <div className="w-64">
              <input 
                type="text" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Buscar socio..." 
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none" 
              />
            </div>
          </div>
          
          {loading ? (
            <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>
          ) : cuotas.length === 0 ? (
            <div className="p-12 text-center"><p className="text-slate-400 text-sm">No hay cuotas que coincidan con los filtros</p></div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Fecha de Cobro</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Socio</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Negocio</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase">Nro Cuota</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase">Monto</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase">Estado</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {cuotas.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {c.estado === 'cobrada' && c.cobrada_en ? formatDate(c.cobrada_en) : '-'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {c.transaccion?.socio?.nombre} {c.transaccion?.socio?.apellido} 
                          <span className="text-xs text-slate-400 font-mono ml-1">({c.transaccion?.socio?.legajo})</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">{c.transaccion?.prestador?.nombre}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-600">#{c.nro_cuota}</td>
                        <td className={`px-4 py-3 text-right font-black ${c.estado === 'anulada' ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                          {formatMoney(c.monto)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.estado === 'cobrada' ? 'bg-emerald-50 text-emerald-600' : c.estado === 'anulada' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>{c.estado}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-50">
                {cuotas.map((c) => (
                  <div key={c.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{c.transaccion?.socio?.nombre} {c.transaccion?.socio?.apellido}</p>
                        <p className="text-xs text-slate-500">{c.transaccion?.prestador?.nombre} - Cuota {c.nro_cuota}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${c.estado === 'anulada' ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>{formatMoney(c.monto)}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.estado === 'cobrada' ? 'bg-emerald-50 text-emerald-600' : c.estado === 'anulada' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>{c.estado}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          
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
