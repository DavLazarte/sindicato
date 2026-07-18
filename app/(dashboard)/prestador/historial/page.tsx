'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Transaccion } from '@/lib/types';
import * as XLSX from 'xlsx-js-style';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function formatDate(d: string) { return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }); }

type EditModal = { open: true; t: Transaccion; newMonto: string; motivo: string } | { open: false };
type AnulModal = { open: true; t: Transaccion; motivo: string } | { open: false };

export default function PrestadorHistorial() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [exporting, setExporting] = useState(false);
  const [recargo, setRecargo] = useState('');
  const [editModal, setEditModal] = useState<EditModal>({ open: false });
  const [anulModal, setAnulModal] = useState<AnulModal>({ open: false });
  const [saving, setSaving] = useState(false);

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<'ventas' | 'cuotas' | 'balance'>('ventas');

  // ── Cuotas cobradas ──
  type CuotaCobrada = { id: number; nro_cuota: number; monto: number; estado: string; cobrada_en: string; transaccion: { id: number; monto_total: number; socio: { nombre: string; apellido: string; legajo: string } }; periodo: { nombre: string } };
  const [cuotas, setCuotas] = useState<CuotaCobrada[]>([]);
  const [cuotasPage, setCuotasPage] = useState(1);
  const [cuotasLastPage, setCuotasLastPage] = useState(1);
  const [cuotasLoading, setCuotasLoading] = useState(false);
  const [cuotasSearch, setCuotasSearch] = useState('');
  const [cuotasDesde, setCuotasDesde] = useState('');
  const [cuotasHasta, setCuotasHasta] = useState('');
  const [exportingCuotas, setExportingCuotas] = useState(false);

  // ── Balance ──
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceData, setBalanceData] = useState<{ totalVentas: number; totalCuotas: number; total: number } | null>(null);
  const [balDesde, setBalDesde] = useState('');
  const [balHasta, setBalHasta] = useState('');

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.append('search', search);
    if (fechaDesde) p.append('fecha_desde', fechaDesde);
    if (fechaHasta) p.append('fecha_hasta', fechaHasta);
    return p.toString();
  }, [search, fechaDesde, fechaHasta]);

  const fetchData = useCallback((p: number) => {
    setLoading(true);
    api.get<ApiResponse<PaginatedData<Transaccion>>>(`/prestador/transacciones?page=${p}&${buildParams()}`)
      .then(res => { setTransacciones(res.data.data); setPage(res.data.current_page); setLastPage(res.data.last_page); })
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => {
    const t = setTimeout(() => fetchData(1), 400);
    return () => clearTimeout(t);
  }, [search, fechaDesde, fechaHasta, fetchData]);

  // ─── EXPORTAR EXCEL ───────────────────────────────────────────
  const handleExportar = async () => {
    setExporting(true);
    try {
      const res = await api.get<ApiResponse<any>>(`/prestador/transacciones?unpaginated=1&${buildParams()}`);
      const data: Transaccion[] = Array.isArray(res.data) ? res.data : res.data.data || [];

      // ── Detalle de transacciones ──
      // Solo ventas directas (es_cuotas=false): las cuotas tienen su propio Excel en la pestaña "Cuotas cobradas"
      // Incluirlas aquí generaría monto_cobrado incorrecto porque ese campo no filtra por fecha de cobro
      const dataRows = data.filter(t => !t.es_cuotas).map(t => ({
        Fecha: new Date(t.created_at).toLocaleString('es-AR'),
        Socio: `${t.socio?.nombre} ${t.socio?.apellido}`,
        Legajo: t.socio?.legajo,
        'Total Venta': t.monto_total,
        'Monto Cobrado': t.monto_cobrado,
        Tipo: t.tipo === 'manual' ? 'Carga manual' : '1 Pago',
        Estado: t.estado,
      }));

      // ── Totales desglosados ──
      // Ventas directas: transacciones 1 pago confirmadas en el rango (created_at)
      const totalVentasDirectas = data
        .filter(t => t.estado !== 'anulada' && !t.es_cuotas)
        .reduce((acc, t) => acc + Number(t.monto_total), 0);

      // Cuotas cobradas: consultamos el endpoint de cuotas filtrado por cobrada_en
      // para NO incluir cuotas pagadas fuera del rango de fechas seleccionado
      const cuotasParams = new URLSearchParams({ unpaginated: 'true' });
      if (fechaDesde) cuotasParams.append('fecha_desde', fechaDesde);
      if (fechaHasta) cuotasParams.append('fecha_hasta', fechaHasta);
      const resCuotas = await api.get<ApiResponse<any>>(`/prestador/cuotas/cobradas?${cuotasParams.toString()}`);
      const cuotasData: any[] = Array.isArray(resCuotas.data) ? resCuotas.data : resCuotas.data.data || [];
      const totalCuotasCobradas = cuotasData.reduce((acc: number, c: any) => acc + Number(c.monto), 0);

      const totalCobrado = totalVentasDirectas + totalCuotasCobradas;
      const pctRecargo = parseFloat(recargo) || 0;
      const montoRecargo = Math.round(totalCobrado * pctRecargo / 100);
      const totalFinal = totalCobrado + montoRecargo;

      // ── Resumen al inicio ──
      const summaryRows: any[] = [];
      summaryRows.push({ Fecha: 'RESUMEN DEL CIERRE', Socio: '', Legajo: '', 'Total Venta': '', 'Monto Cobrado': '', Tipo: '', Estado: '' });
      summaryRows.push({ Fecha: 'Ventas directas (1 pago)', Socio: '', Legajo: '', 'Total Venta': '', 'Monto Cobrado': totalVentasDirectas, Tipo: '', Estado: '' });
      summaryRows.push({ Fecha: 'Cuotas cobradas', Socio: '', Legajo: '', 'Total Venta': '', 'Monto Cobrado': totalCuotasCobradas, Tipo: '', Estado: '' });
      summaryRows.push({ Fecha: 'TOTAL COBRADO', Socio: '', Legajo: '', 'Total Venta': '', 'Monto Cobrado': totalCobrado, Tipo: '', Estado: '' });
      if (pctRecargo > 0) {
        summaryRows.push({ Fecha: `Actualización de precios ${pctRecargo}%`, Socio: '', Legajo: '', 'Total Venta': '', 'Monto Cobrado': montoRecargo, Tipo: '', Estado: '' });
        summaryRows.push({ Fecha: 'TOTAL A LIQUIDAR', Socio: '', Legajo: '', 'Total Venta': '', 'Monto Cobrado': totalFinal, Tipo: '', Estado: '' });
      }
      // Fila vacía separadora
      summaryRows.push({ Fecha: '', Socio: '', Legajo: '', 'Total Venta': '', 'Monto Cobrado': '', Tipo: '', Estado: '' });

      const allRows = [...summaryRows, ...dataRows];
      const summaryCount = summaryRows.length;

      const ws = XLSX.utils.json_to_sheet(allRows);
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:G1');

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const ref = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[ref]) continue;
          ws[ref].s = { font: { name: 'Arial', sz: 10 }, alignment: { vertical: 'center' } };
          // Encabezado de columnas
          if (R === 0) {
            ws[ref].s.font = { ...ws[ref].s.font, bold: true, color: { rgb: 'FFFFFF' } };
            ws[ref].s.fill = { fgColor: { rgb: '064E3B' } };
            ws[ref].s.alignment = { horizontal: 'center', vertical: 'center' };
          }
          // Filas de resumen
          if (R >= 1 && R <= summaryCount) {
            ws[ref].s.font = { ...ws[ref].s.font, bold: true, color: { rgb: '065F46' } };
            ws[ref].s.fill = { fgColor: { rgb: 'D1FAE5' } };
          }
          // Título RESUMEN y TOTAL A LIQUIDAR resaltados
          if (R === 1 || (pctRecargo > 0 && R === summaryCount - 1)) {
            ws[ref].s.font = { ...ws[ref].s.font, bold: true, sz: 11, color: { rgb: 'FFFFFF' } };
            ws[ref].s.fill = { fgColor: { rgb: '064E3B' } };
          }
        }
      }
      ws['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cierre');
      const desde = fechaDesde || 'inicio';
      const hasta = fechaHasta || 'hoy';
      XLSX.writeFile(wb, `Cierre_${desde}_al_${hasta}.xlsx`);
    } catch {
      alert('Error al exportar.');
    } finally {
      setExporting(false);
    }
  };

  // ── Cuotas cobradas ──
  const buildCuotasParams = useCallback(() => {
    const p = new URLSearchParams();
    if (cuotasSearch) p.append('search', cuotasSearch);
    if (cuotasDesde) p.append('fecha_desde', cuotasDesde);
    if (cuotasHasta) p.append('fecha_hasta', cuotasHasta);
    return p.toString();
  }, [cuotasSearch, cuotasDesde, cuotasHasta]);

  const fetchCuotas = useCallback((p: number) => {
    setCuotasLoading(true);
    api.get<ApiResponse<any>>(`/prestador/cuotas/cobradas?page=${p}&${buildCuotasParams()}`)
      .then(res => {
        const d = res.data;
        setCuotas(Array.isArray(d) ? d : d.data || []);
        setCuotasPage(d.current_page || 1);
        setCuotasLastPage(d.last_page || 1);
      })
      .finally(() => setCuotasLoading(false));
  }, [buildCuotasParams]);

  useEffect(() => {
    if (activeTab !== 'cuotas') return;
    const t = setTimeout(() => fetchCuotas(1), 400);
    return () => clearTimeout(t);
  }, [activeTab, cuotasSearch, cuotasDesde, cuotasHasta, fetchCuotas]);

  const handleExportarCuotas = async () => {
    setExportingCuotas(true);
    try {
      const res = await api.get<ApiResponse<any>>(`/prestador/cuotas/cobradas?unpaginated=true&${buildCuotasParams()}`);
      const data: any[] = Array.isArray(res.data) ? res.data : res.data.data || [];
      const totalCobrado = data.reduce((acc: number, c: any) => acc + Number(c.monto), 0);

      const summaryRows: any[] = [
        { 'Fecha cobro': 'RESUMEN CUOTAS COBRADAS', Socio: '', Legajo: '', 'N° Cuota': '', 'Total venta': '', 'Monto cobrado': '', Período: '' },
        { 'Fecha cobro': 'Total cobrado en cuotas', Socio: '', Legajo: '', 'N° Cuota': '', 'Total venta': '', 'Monto cobrado': totalCobrado, Período: '' },
        { 'Fecha cobro': '', Socio: '', Legajo: '', 'N° Cuota': '', 'Total venta': '', 'Monto cobrado': '', Período: '' },
      ];

      const dataRows = data.map((c: any) => ({
        'Fecha cobro': new Date(c.cobrada_en).toLocaleDateString('es-AR'),
        Socio: `${c.transaccion?.socio?.nombre} ${c.transaccion?.socio?.apellido}`,
        Legajo: c.transaccion?.socio?.legajo,
        'N° Cuota': c.nro_cuota,
        'Total venta': c.transaccion?.monto_total,
        'Monto cobrado': c.monto,
        Período: c.periodo?.nombre,
      }));

      const allRows = [...summaryRows, ...dataRows];
      const ws = XLSX.utils.json_to_sheet(allRows);
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:G1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const ref = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[ref]) continue;
          ws[ref].s = { font: { name: 'Arial', sz: 10 }, alignment: { vertical: 'center' } };
          if (R === 0) { ws[ref].s.font = { ...ws[ref].s.font, bold: true, color: { rgb: 'FFFFFF' } }; ws[ref].s.fill = { fgColor: { rgb: '4338CA' } }; ws[ref].s.alignment = { horizontal: 'center', vertical: 'center' }; }
          if (R === 1) { ws[ref].s.font = { ...ws[ref].s.font, bold: true, color: { rgb: 'FFFFFF' } }; ws[ref].s.fill = { fgColor: { rgb: '4338CA' } }; }
          if (R === 2) { ws[ref].s.font = { ...ws[ref].s.font, bold: true, color: { rgb: '3730A3' } }; ws[ref].s.fill = { fgColor: { rgb: 'E0E7FF' } }; }
        }
      }
      ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cuotas cobradas');
      XLSX.writeFile(wb, `Cuotas_cobradas_${cuotasDesde || 'inicio'}_al_${cuotasHasta || 'hoy'}.xlsx`);
    } catch {
      alert('Error al exportar cuotas.');
    } finally {
      setExportingCuotas(false);
    }
  };

  // ── Balance general ──
  const handleBalance = async () => {
    setBalanceLoading(true);
    try {
      const pVentas = new URLSearchParams({ unpaginated: '1' });
      if (balDesde) pVentas.append('fecha_desde', balDesde);
      if (balHasta) pVentas.append('fecha_hasta', balHasta);
      const pCuotas = new URLSearchParams({ unpaginated: 'true' });
      if (balDesde) pCuotas.append('fecha_desde', balDesde);
      if (balHasta) pCuotas.append('fecha_hasta', balHasta);

      const [resVentas, resCuotas] = await Promise.all([
        api.get<ApiResponse<any>>(`/prestador/transacciones?${pVentas.toString()}`),
        api.get<ApiResponse<any>>(`/prestador/cuotas/cobradas?${pCuotas.toString()}`),
      ]);

      const ventas: Transaccion[] = Array.isArray(resVentas.data) ? resVentas.data : resVentas.data.data || [];
      const cuotasData: any[] = Array.isArray(resCuotas.data) ? resCuotas.data : resCuotas.data.data || [];

      const totalVentas = ventas.filter(t => t.estado !== 'anulada' && !t.es_cuotas).reduce((acc, t) => acc + Number(t.monto_total), 0);
      const totalCuotas = cuotasData.reduce((acc: number, c: any) => acc + Number(c.monto), 0);
      setBalanceData({ totalVentas, totalCuotas, total: totalVentas + totalCuotas });
    } catch {
      alert('Error al calcular el balance.');
    } finally {
      setBalanceLoading(false);
    }
  };

  // ─── EDITAR ───────────────────────────────────────────────────
  const handleConfirmEditar = async () => {
    if (!editModal.open) return;
    const nuevoMonto = parseFloat(editModal.newMonto);
    if (!nuevoMonto || nuevoMonto <= 0) return alert('Ingresá un monto válido.');
    if (!editModal.motivo.trim()) return alert('El motivo de la edición es obligatorio.');
    
    setSaving(true);
    try {
      await api.put(`/prestador/transacciones/${editModal.t.id}`, { 
        monto_total: nuevoMonto,
        motivo_edicion: editModal.motivo,
      });
      setEditModal({ open: false });
      fetchData(page);
    } catch (err: any) {
      alert(err?.message || 'Error al editar.');
    } finally {
      setSaving(false);
    }
  };

  // ─── ANULAR ───────────────────────────────────────────────────
  const handleConfirmAnular = async () => {
    if (!anulModal.open) return;
    if (!anulModal.motivo.trim()) return alert('El motivo es obligatorio.');
    setSaving(true);
    try {
      await api.post(`/prestador/transacciones/${anulModal.t.id}/anular`, { motivo_anulacion: anulModal.motivo });
      setAnulModal({ open: false });
      fetchData(page);
    } catch (err: any) {
      alert(err?.message || 'Error al anular.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Historial" subtitle="Mis cobros" />

      {/* ─── MODAL EDITAR ─── */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-black text-slate-800 mb-1">Editar monto de venta</h3>
            <p className="text-sm text-slate-500 mb-4">
              {editModal.t.socio?.nombre} {editModal.t.socio?.apellido} · Monto actual: <strong>{formatMoney(editModal.t.monto_total)}</strong>
            </p>
            <label className="block text-xs font-bold text-slate-500 mb-1">Nuevo monto</label>
            <input
              type="number"
              value={editModal.newMonto}
              onChange={e => setEditModal({ ...editModal, newMonto: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 mb-3"
              placeholder="0"
            />
            {editModal.newMonto && parseFloat(editModal.newMonto) > 0 && parseFloat(editModal.newMonto) !== editModal.t.monto_total && (
              <div className={`text-xs rounded-xl px-3 py-2 mb-4 font-medium ${parseFloat(editModal.newMonto) < editModal.t.monto_total ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {parseFloat(editModal.newMonto) < editModal.t.monto_total
                  ? `✅ Se devolverán ${formatMoney(editModal.t.monto_total - parseFloat(editModal.newMonto))} al socio`
                  : `⚠️ Se descontarán ${formatMoney(parseFloat(editModal.newMonto) - editModal.t.monto_total)} del socio`}
              </div>
            )}
            <label className="block text-xs font-bold text-slate-500 mb-1">Motivo de edición <span className="text-red-500">*</span></label>
            <textarea
              value={editModal.motivo}
              onChange={e => setEditModal({ ...editModal, motivo: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 mb-4 resize-none"
              placeholder="Ej: El socio devolvió un producto..."
            />
            <div className="flex gap-2">
              <button onClick={() => setEditModal({ open: false })} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleConfirmEditar} disabled={saving} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ANULAR ─── */}
      {anulModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-black text-slate-800 mb-1">Anular venta</h3>
            <p className="text-sm text-slate-500 mb-1">
              {anulModal.t.socio?.nombre} {anulModal.t.socio?.apellido} · <strong>{formatMoney(anulModal.t.monto_cobrado)}</strong> cobrado hasta ahora
            </p>
            {anulModal.t.es_cuotas && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-3">⚠️ Solo se devolverá lo ya cobrado. Las cuotas pendientes se cancelarán automáticamente.</p>
            )}
            <label className="block text-xs font-bold text-slate-500 mb-1">Motivo <span className="text-red-500">*</span></label>
            <textarea
              value={anulModal.motivo}
              onChange={e => setAnulModal({ ...anulModal, motivo: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-red-400 mb-4 resize-none"
              placeholder="Ej: El socio presentó receta con descuento del 40%..."
            />
            <div className="flex gap-2">
              <button onClick={() => setAnulModal({ open: false })} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleConfirmAnular} disabled={saving} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50">
                {saving ? 'Anulando...' : 'Anular venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 space-y-4">

        {/* ─── TABS ─── */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
          {([['ventas', '💰 Ventas'], ['cuotas', '✅ Cuotas cobradas'], ['balance', '📊 Balance general']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ─── TAB: VENTAS ─── */}
        {activeTab === 'ventas' && (
          <>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h2 className="text-base font-bold text-slate-800">Filtros y Cierre mensual</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">+ Actualización %</span>
                    <input type="number" min="0" max="100" step="0.5" value={recargo} onChange={e => setRecargo(e.target.value)} placeholder="0" className="w-14 bg-transparent text-sm font-bold text-slate-700 outline-none text-right" />
                  </div>
                  <button onClick={handleExportar} disabled={exporting} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap">
                    {exporting ? 'Generando...' : '📊 Exportar Cierre'}
                  </button>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Buscar socio</label>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o legajo..." className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Desde</label>
                  <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Hasta</label>
                  <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-800">Mis ventas</h2>
              </div>
              {loading ? (
                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
              ) : transacciones.length === 0 ? (
                <div className="p-12 text-center"><span className="text-4xl block mb-3">📦</span><p className="text-slate-400 text-sm">Sin ventas en este período</p></div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {transacciones.map(t => {
                    const isAnulada = t.estado === 'anulada';
                    const isManual = t.tipo === 'manual';
                    return (
                      <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 ${isAnulada ? 'bg-slate-100' : isManual ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                            {isManual ? '📂' : isAnulada ? '❌' : t.es_cuotas ? '💳' : '💰'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{t.socio?.nombre} {t.socio?.apellido}</p>
                            <p className="text-xs text-slate-400 mb-1">{t.socio?.legajo} · {formatDate(t.created_at)}</p>
                            {t.detalle && <p className="text-xs text-slate-600 mb-1 font-medium bg-slate-100 px-2 py-0.5 rounded-md inline-block">📝 {t.detalle}</p>}
                            <div className="flex gap-1 flex-wrap">
                              {isManual && <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full">Carga manual</span>}
                              {t.es_cuotas && !isManual && <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">En cuotas</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-black ${isAnulada ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>
                              +{formatMoney(t.monto_cobrado)}
                            </p>
                            {t.es_cuotas && <p className="text-[10px] text-slate-400">Total: {formatMoney(t.monto_total)}</p>}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-600' : isAnulada ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>
                              {t.estado}
                            </span>
                          </div>
                        </div>
                        {!isAnulada && (
                          <div className="flex gap-2 mt-3 ml-13">
                            {!t.es_cuotas && !isManual && (
                              <button onClick={() => setEditModal({ open: true, t, newMonto: String(t.monto_total), motivo: '' })} className="text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">✏️ Editar monto</button>
                            )}
                            <button onClick={() => setAnulModal({ open: true, t, motivo: '' })} className="text-xs font-bold px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors">🗑 Anular</button>
                          </div>
                        )}
                        {isAnulada && t.motivo_anulacion && (
                          <p className="text-xs text-slate-400 mt-2 ml-13 italic">Motivo de anulación: {t.motivo_anulacion}</p>
                        )}
                        {t.motivo_edicion && (
                          <div className="mt-2 ml-13 bg-amber-50/50 border border-amber-100 p-2 rounded-xl">
                            <p className="text-[11px] font-bold text-amber-800">Venta editada</p>
                            <p className="text-xs text-amber-700 mt-0.5">Motivo: {t.motivo_edicion}</p>
                            {t.editada_por_user && <p className="text-[10px] text-amber-600/70 mt-1">Por: {t.editada_por_user.name}</p>}
                          </div>
                        )}
                        {t.audit_logs && t.audit_logs.length > 0 && (
                          <div className="mt-3 ml-13 space-y-1.5">
                            {t.audit_logs.map((log: any) => {
                              const antes = Number(log.valores_antes.monto_total || 0);
                              const despues = Number(log.valores_despues.monto_total || 0);
                              const dif = despues - antes;
                              return (
                                <p key={log.id} className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 px-2 py-1.5 rounded-lg inline-flex">
                                  <span className="text-sm">{dif < 0 ? '↘️' : '↗️'}</span>
                                  <span>{dif < 0 ? 'Se devolvió' : 'Se agregó'} <strong>{formatMoney(Math.abs(dif))}</strong> al socio el {formatDate(log.created_at)}</span>
                                </p>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {lastPage > 1 && (
                <div className="p-4 border-t border-slate-100 flex justify-center gap-2">
                  <button disabled={page <= 1} onClick={() => fetchData(page - 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200">Anterior</button>
                  <span className="px-4 py-2 text-sm text-slate-500">{page} / {lastPage}</span>
                  <button disabled={page >= lastPage} onClick={() => fetchData(page + 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200">Siguiente</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── TAB: CUOTAS COBRADAS ─── */}
        {activeTab === 'cuotas' && (
          <>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h2 className="text-base font-bold text-slate-800">Cuotas cobradas</h2>
                <button onClick={handleExportarCuotas} disabled={exportingCuotas} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap">
                  {exportingCuotas ? 'Generando...' : '📊 Exportar Excel'}
                </button>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Buscar socio</label>
                  <input type="text" value={cuotasSearch} onChange={e => setCuotasSearch(e.target.value)} placeholder="Nombre o legajo..." className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fecha cobro desde</label>
                  <input type="date" value={cuotasDesde} onChange={e => setCuotasDesde(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Hasta</label>
                  <input type="date" value={cuotasHasta} onChange={e => setCuotasHasta(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {cuotasLoading ? (
                <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
              ) : cuotas.length === 0 ? (
                <div className="p-12 text-center"><span className="text-4xl block mb-3">💳</span><p className="text-slate-400 text-sm">Sin cuotas cobradas en este rango</p></div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {cuotas.map(c => (
                    <div key={c.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">💳</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{c.transaccion?.socio?.nombre} {c.transaccion?.socio?.apellido}</p>
                        <p className="text-xs text-slate-400">Legajo {c.transaccion?.socio?.legajo} · Cuota {c.nro_cuota} · {c.periodo?.nombre}</p>
                        <p className="text-xs text-slate-400">Fecha cobro: <span className="font-medium text-slate-600">{new Date(c.cobrada_en).toLocaleDateString('es-AR')}</span></p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-indigo-600">+{formatMoney(c.monto)}</p>
                        <p className="text-[10px] text-slate-400">Venta: {formatMoney(c.transaccion?.monto_total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cuotasLastPage > 1 && (
                <div className="p-4 border-t border-slate-100 flex justify-center gap-2">
                  <button disabled={cuotasPage <= 1} onClick={() => fetchCuotas(cuotasPage - 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200">Anterior</button>
                  <span className="px-4 py-2 text-sm text-slate-500">{cuotasPage} / {cuotasLastPage}</span>
                  <button disabled={cuotasPage >= cuotasLastPage} onClick={() => fetchCuotas(cuotasPage + 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200">Siguiente</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── TAB: BALANCE GENERAL ─── */}
        {activeTab === 'balance' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Balance general</h2>
              <p className="text-xs text-slate-400 mt-0.5">Seleccioná un rango de fechas para ver el resumen de ingresos</p>
            </div>
            <div className="p-5">
              <div className="flex flex-col sm:flex-row gap-3 items-end mb-5">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Desde</label>
                  <input type="date" value={balDesde} onChange={e => setBalDesde(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Hasta</label>
                  <input type="date" value={balHasta} onChange={e => setBalHasta(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
                </div>
                <button onClick={handleBalance} disabled={balanceLoading} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 whitespace-nowrap">
                  {balanceLoading ? 'Calculando...' : '🔍 Ver balance'}
                </button>
              </div>

              {balanceData ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-600 mb-1">💰 Ventas directas</p>
                    <p className="text-2xl font-black text-emerald-700">{formatMoney(balanceData.totalVentas)}</p>
                    <p className="text-[10px] text-emerald-500 mt-1">Pagos en un único cobro</p>
                  </div>
                  <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-600 mb-1">💳 Cuotas cobradas</p>
                    <p className="text-2xl font-black text-indigo-700">{formatMoney(balanceData.totalCuotas)}</p>
                    <p className="text-[10px] text-indigo-500 mt-1">Suma de cuotas individuales</p>
                  </div>
                  <div className="bg-slate-800 rounded-2xl p-5">
                    <p className="text-xs font-bold text-slate-300 mb-1">📊 Total general</p>
                    <p className="text-2xl font-black text-white">{formatMoney(balanceData.total)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Ventas + cuotas del período</p>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center">
                  <span className="text-5xl block mb-3">📊</span>
                  <p className="text-slate-400 text-sm">Ingresá un rango y presioná Ver balance</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
