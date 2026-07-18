'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Transaccion, Periodo } from '@/lib/types';
import * as XLSX from 'xlsx-js-style';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function formatDate(date: string) { return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default function AdminTransacciones() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [prestadorId, setPrestadorId] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [estado, setEstado] = useState('');
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [prestadores, setPrestadores] = useState<{id: number, nombre: string}[]>([]);
  const [exporting, setExporting] = useState(false);
  const [expandedTransaccion, setExpandedTransaccion] = useState<number | null>(null);

  // ── Resumen por negocio ──
  const [resumenModal, setResumenModal] = useState(false);
  const [resumenDesde, setResumenDesde] = useState('');
  const [resumenHasta, setResumenHasta] = useState('');
  const [resumenData, setResumenData] = useState<{nombre: string; totalVentas: number; totalCuotas: number; total: number}[]>([]);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenExporting, setResumenExporting] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<Periodo[]>>('/admin/periodos').then(res => setPeriodos(res.data || []));
    api.get<ApiResponse<any>>('/admin/prestadores?unpaginated=1').then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.data || [];
      setPrestadores(data);
    });
  }, []);

  const toggleExpanded = (id: number) => {
    setExpandedTransaccion(expandedTransaccion === id ? null : id);
  };

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

    api.get<ApiResponse<PaginatedData<Transaccion>>>(`/admin/transacciones?${params.toString()}`)
      .then((res) => { setTransacciones(res.data.data); setPage(res.data.current_page); setLastPage(res.data.last_page); })
      .finally(() => setLoading(false));
  }, [search, periodoId, prestadorId, fechaDesde, fechaHasta, estado]);

  useEffect(() => { 
    const timer = setTimeout(() => {
      fetchData(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, periodoId, prestadorId, fechaDesde, fechaHasta, estado, fetchData]);

  const handleAnular = async (id: number) => {
    if (!confirm('¿Estás seguro de anular esta transacción? Se devolverá el saldo al socio.')) return;
    try {
      await api.post(`/admin/transacciones/${id}/anular`);
      alert('Transacción anulada correctamente.');
      fetchData(page);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al anular');
    }
  };

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

      const res = await api.get<ApiResponse<any>>(`/admin/transacciones?${params.toString()}`);
      const data: Transaccion[] = Array.isArray(res.data) ? res.data : res.data.data || [];
      
      const rows = data.map(t => ({
        Fecha: new Date(t.created_at).toLocaleString('es-AR'),
        Socio: `${t.socio?.nombre} ${t.socio?.apellido}`,
        Legajo: t.socio?.legajo,
        Negocio: t.prestador?.nombre,
        "Total Venta": t.monto_total,
        "Monto Cobrado": t.monto_cobrado,
        Cuotas: t.es_cuotas ? 'Sí' : 'No',
        Estado: t.estado,
      }));

      const totalVenta = data.reduce((acc, t) => t.estado === 'confirmada' ? acc + Number(t.monto_total) : acc, 0);
      const totalCobrado = data.reduce((acc, t) => t.estado === 'confirmada' ? acc + Number(t.monto_cobrado) : acc, 0);
      
      rows.push({
        Fecha: '', Socio: '', Legajo: '', Negocio: '', "Total Venta": totalVenta, "Monto Cobrado": totalCobrado, Cuotas: 'TOTAL CONFIRMADAS', Estado: '' as any
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      
      // Aplicar estilos con xlsx-js-style
      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:G1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = { c: C, r: R };
          const cellRef = XLSX.utils.encode_cell(cellAddress);
          if (!ws[cellRef]) continue;
          
          ws[cellRef].s = {
            font: { name: "Arial", sz: 10 },
            alignment: { vertical: "center" }
          };

          // Formato Encabezados
          if (R === 0) {
            ws[cellRef].s.font.bold = true;
            ws[cellRef].s.font.color = { rgb: "FFFFFF" };
            ws[cellRef].s.fill = { fgColor: { rgb: "475569" } }; // slate-600
            ws[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
          }
          
          // Formato Fila Total
          if (R === range.e.r) {
            ws[cellRef].s.font.bold = true;
            ws[cellRef].s.fill = { fgColor: { rgb: "D1FAE5" } }; // emerald-100
            if (C === 4 || C === 5) {
              ws[cellRef].s.font.color = { rgb: "065F46" }; // emerald-800
            }
          }
        }
      }

      // Ancho de columnas
      ws['!cols'] = [
        { wch: 18 }, // Fecha
        { wch: 30 }, // Socio
        { wch: 10 }, // Legajo
        { wch: 30 }, // Negocio
        { wch: 15 }, // Total Venta
        { wch: 15 }, // Monto Cobrado
        { wch: 20 }, // Cuotas / Texto TOTAL
        { wch: 15 }, // Estado
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ventas");
      XLSX.writeFile(wb, "Reporte_Ventas.xlsx");

    } catch (err) {
      alert("Error al exportar los datos.");
    } finally {
      setExporting(false);
    }
  };

  // ── Resumen por negocio ──
  const handleBuildResumen = async () => {
    if (!resumenDesde || !resumenHasta) return alert('Ingresá las dos fechas.');
    setResumenLoading(true);
    try {
      // Traer todas las transacciones del rango
      const params = new URLSearchParams({ unpaginated: '1', fecha_desde: resumenDesde, fecha_hasta: resumenHasta });
      const res = await api.get<ApiResponse<any>>(`/admin/transacciones?${params.toString()}`);
      const txData: Transaccion[] = Array.isArray(res.data) ? res.data : res.data.data || [];

      // Traer cuotas cobradas del rango
      const cuotasRes = await api.get<ApiResponse<any>>(`/admin/cuotas?unpaginated=true&fecha_desde=${resumenDesde}&fecha_hasta=${resumenHasta}`);
      const cuotasData: any[] = Array.isArray(cuotasRes.data) ? cuotasRes.data : cuotasRes.data.data || [];

      // Agrupar ventas por negocio
      // Solo pagos directos (es_cuotas=false) en totalVentas
      // Las cuotas cobradas vienen del endpoint de cuotas (totalCuotas)
      const mapa: Record<number, { nombre: string; totalVentas: number; totalCuotas: number }> = {};

      txData.filter(t => t.estado === 'confirmada' && !t.es_cuotas).forEach(t => {
        const pid = t.prestador?.id ?? 0;
        if (!mapa[pid]) mapa[pid] = { nombre: t.prestador?.nombre ?? 'Sin nombre', totalVentas: 0, totalCuotas: 0 };
        mapa[pid].totalVentas += Number(t.monto_total);
      });

      cuotasData.filter((c: any) => c.estado === 'cobrada').forEach((c: any) => {
        const pid = c.transaccion?.prestador?.id ?? 0;
        const nombre = c.transaccion?.prestador?.nombre ?? 'Sin nombre';
        if (!mapa[pid]) mapa[pid] = { nombre, totalVentas: 0, totalCuotas: 0 };
        mapa[pid].totalCuotas += Number(c.monto);
      });

      const rows = Object.values(mapa)
        .map(r => ({ ...r, total: r.totalVentas + r.totalCuotas }))
        .sort((a, b) => b.total - a.total);

      setResumenData(rows);
    } catch {
      alert('Error al generar el resumen.');
    } finally {
      setResumenLoading(false);
    }
  };

  const handleExportarResumen = () => {
    if (resumenData.length === 0) return;
    setResumenExporting(true);
    try {
      const totVentas = resumenData.reduce((a, r) => a + r.totalVentas, 0);
      const totCuotas = resumenData.reduce((a, r) => a + r.totalCuotas, 0);
      const totGeneral = totVentas + totCuotas;

      const rows = [
        ...resumenData.map(r => ({
          'Negocio': r.nombre,
          'Total Ventas': r.totalVentas,
          'Total Cobros Cuotas': r.totalCuotas,
          'Total General': r.total,
        })),
        { 'Negocio': 'TOTAL', 'Total Ventas': totVentas, 'Total Cobros Cuotas': totCuotas, 'Total General': totGeneral },
      ];

      const ws = XLSX.utils.json_to_sheet(rows);
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:D1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const ref = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[ref]) continue;
          ws[ref].s = { font: { name: 'Arial', sz: 10 }, alignment: { vertical: 'center' } };
          if (R === 0) { ws[ref].s.font = { ...ws[ref].s.font, bold: true, color: { rgb: 'FFFFFF' } }; ws[ref].s.fill = { fgColor: { rgb: '475569' } }; ws[ref].s.alignment = { horizontal: 'center', vertical: 'center' }; }
          if (R === range.e.r) { ws[ref].s.font = { ...ws[ref].s.font, bold: true, color: { rgb: '065F46' } }; ws[ref].s.fill = { fgColor: { rgb: 'D1FAE5' } }; }
        }
      }
      ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Resumen por Negocio');
      XLSX.writeFile(wb, `Resumen_${resumenDesde}_al_${resumenHasta}.xlsx`);
    } finally {
      setResumenExporting(false);
    }
  };

  return (
    <>
      <TopBar title="Ventas globales" subtitle="Transacciones" />

      {/* Modal Resumen por Negocio */}
      {resumenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-800">Resumen por Negocio</h2>
                <p className="text-xs text-slate-400 mt-0.5">Totales de ventas y cuotas por negocio en el rango seleccionado</p>
              </div>
              <button onClick={() => { setResumenModal(false); setResumenData([]); }} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-lg font-bold transition-colors">×</button>
            </div>

            <div className="p-6 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Desde</label>
                  <input type="date" value={resumenDesde} onChange={e => setResumenDesde(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Hasta</label>
                  <input type="date" value={resumenHasta} onChange={e => setResumenHasta(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none" />
                </div>
                <button
                  onClick={handleBuildResumen}
                  disabled={resumenLoading}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {resumenLoading ? 'Cargando...' : '🔍 Consultar'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {resumenData.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">{resumenLoading ? 'Generando resumen...' : 'Ingresá un rango de fechas y presioná Consultar.'}</div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-5 py-3 font-bold text-slate-600">Negocio</th>
                        <th className="text-right px-5 py-3 font-bold text-slate-600">Ventas</th>
                        <th className="text-right px-5 py-3 font-bold text-slate-600">Cuotas</th>
                        <th className="text-right px-5 py-3 font-bold text-slate-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {resumenData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-slate-700">{r.nombre}</td>
                          <td className="px-5 py-3 text-right text-slate-500">{r.totalVentas > 0 ? formatMoney(r.totalVentas) : <span className="text-slate-300">-</span>}</td>
                          <td className="px-5 py-3 text-right text-slate-500">{r.totalCuotas > 0 ? formatMoney(r.totalCuotas) : <span className="text-slate-300">-</span>}</td>
                          <td className="px-5 py-3 text-right font-bold text-emerald-700">{formatMoney(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                        <td className="px-5 py-3 font-black text-emerald-800">TOTAL GENERAL</td>
                        <td className="px-5 py-3 text-right font-black text-emerald-800">{formatMoney(resumenData.reduce((a, r) => a + r.totalVentas, 0))}</td>
                        <td className="px-5 py-3 text-right font-black text-emerald-800">{formatMoney(resumenData.reduce((a, r) => a + r.totalCuotas, 0))}</td>
                        <td className="px-5 py-3 text-right font-black text-emerald-800">{formatMoney(resumenData.reduce((a, r) => a + r.total, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>

            {resumenData.length > 0 && (
              <div className="p-5 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleExportarResumen}
                  disabled={resumenExporting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  {resumenExporting ? 'Generando...' : '📊 Exportar a Excel'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4 md:p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <h2 className="text-lg font-black text-slate-800">Filtros y Exportación</h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setResumenModal(true)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
              >
                🏢 Resumen por Negocio
              </button>
              <button 
                onClick={handleExportar}
                disabled={exporting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
              >
                {exporting ? 'Generando Excel...' : '📊 Exportar a Excel'}
              </button>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Buscar (Socio/Negocio)</label>
              <input 
                type="text" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Nombre, legajo..." 
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Negocio (Prestador)</label>
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
              <label className="block text-xs font-bold text-slate-500 mb-1">Mes / Período</label>
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
              <label className="block text-xs font-bold text-slate-500 mb-1">Desde Fecha</label>
              <input 
                type="date" 
                value={fechaDesde} 
                onChange={(e) => setFechaDesde(e.target.value)} 
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Hasta Fecha</label>
              <input 
                type="date" 
                value={fechaHasta} 
                onChange={(e) => setFechaHasta(e.target.value)} 
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Estado</label>
              <select 
                value={estado} 
                onChange={(e) => setEstado(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 outline-none"
              >
                <option value="">Todos los estados</option>
                <option value="confirmada">Confirmada</option>
                <option value="pendiente">Pendiente</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-lg font-black text-slate-800">Historial de Ventas</h2>
          </div>
          
          {/* Table / List */}
          {loading ? (
            <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>
          ) : transacciones.length === 0 ? (
            <div className="p-12 text-center"><p className="text-slate-400 text-sm">No hay transacciones registradas</p></div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Fecha</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Socio</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Negocio</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase">Cobrado</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase">Estado</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase">Acciones</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {transacciones.map((t) => (
                      <React.Fragment key={t.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(t.created_at)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{t.socio?.nombre} {t.socio?.apellido} <span className="text-xs text-slate-400 font-mono ml-1">({t.socio?.legajo})</span></td>
                          <td className="px-4 py-3 font-medium text-slate-700">{t.prestador?.nombre}</td>
                          <td className={`px-4 py-3 text-right font-bold ${t.estado === 'anulada' ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                            {formatMoney(t.monto_cobrado)}
                            {t.es_cuotas && (
                              <>
                                <span className="block text-[10px] text-slate-500 font-medium">de {formatMoney(t.monto_total)}</span>
                                <button onClick={() => toggleExpanded(t.id)} className="block ml-auto mt-1 text-[10px] text-blue-500 hover:text-blue-700 font-bold underline cursor-pointer focus:outline-none">
                                  {expandedTransaccion === t.id ? 'Ocultar cuotas' : 'Ver cuotas'}
                                </button>
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-600' : t.estado === 'anulada' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>{t.estado}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {t.estado === 'confirmada' && (
                              <button onClick={() => handleAnular(t.id)} className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">Anular</button>
                            )}
                          </td>
                        </tr>
                        {expandedTransaccion === t.id && t.es_cuotas && t.cuotas && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={6} className="px-4 py-4 border-t border-dashed border-slate-200">
                              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm max-w-3xl mx-auto">
                                <h4 className="text-sm font-bold text-slate-800 mb-3">Detalle de Cuotas</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {t.cuotas.map(c => (
                                    <div key={c.id} className={`p-3 rounded-xl border ${c.estado === 'cobrada' ? 'bg-emerald-50 border-emerald-100' : c.estado === 'anulada' ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-100'}`}>
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-slate-600">Cuota {c.nro_cuota}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${c.estado === 'cobrada' ? 'bg-emerald-100 text-emerald-700' : c.estado === 'anulada' ? 'bg-slate-200 text-slate-600' : 'bg-amber-200 text-amber-700'}`}>{c.estado}</span>
                                      </div>
                                      <p className="text-sm font-black text-slate-800">{formatMoney(c.monto)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-50">
                {transacciones.map((t) => (
                  <div key={t.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{t.socio?.nombre} {t.socio?.apellido}</p>
                        <p className="text-xs text-slate-500">{t.prestador?.nombre}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${t.estado === 'anulada' ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                          {formatMoney(t.monto_cobrado)}
                        </p>
                        {t.es_cuotas && (
                          <p className="text-[10px] text-slate-500 font-medium mb-1">Total: {formatMoney(t.monto_total)}</p>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-600' : t.estado === 'anulada' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>{t.estado}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-[10px] text-slate-400">{formatDate(t.created_at)}</p>
                      <div className="flex items-center gap-2">
                        {t.es_cuotas && (
                          <button onClick={() => toggleExpanded(t.id)} className="text-xs font-bold text-blue-500 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg focus:outline-none">
                            {expandedTransaccion === t.id ? 'Ocultar' : 'Cuotas'}
                          </button>
                        )}
                        {t.estado === 'confirmada' && (
                          <button onClick={() => handleAnular(t.id)} className="text-xs font-bold text-red-500 px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg">Anular</button>
                        )}
                      </div>
                    </div>
                    
                    {expandedTransaccion === t.id && t.es_cuotas && t.cuotas && (
                      <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                        <h4 className="text-xs font-bold text-slate-800 mb-2">Detalle de Cuotas</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {t.cuotas.map(c => (
                            <div key={c.id} className={`p-2 rounded-lg border ${c.estado === 'cobrada' ? 'bg-emerald-50 border-emerald-100' : c.estado === 'anulada' ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-100'}`}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-slate-600">Cuota {c.nro_cuota}</span>
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${c.estado === 'cobrada' ? 'bg-emerald-100 text-emerald-700' : c.estado === 'anulada' ? 'bg-slate-200 text-slate-600' : 'bg-amber-200 text-amber-700'}`}>{c.estado}</span>
                              </div>
                              <p className="text-xs font-black text-slate-800">{formatMoney(c.monto)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
