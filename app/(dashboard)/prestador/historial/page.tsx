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

      const rows = data.map(t => ({
        Fecha: new Date(t.created_at).toLocaleString('es-AR'),
        Socio: `${t.socio?.nombre} ${t.socio?.apellido}`,
        Legajo: t.socio?.legajo,
        'Total Venta': t.monto_total,
        'Monto Cobrado': t.monto_cobrado,
        Tipo: t.es_cuotas ? 'Cuotas' : t.tipo === 'manual' ? 'Carga manual' : '1 Pago',
        Estado: t.estado,
      }));

      const totalCobrado = data.reduce((acc, t) => t.estado !== 'anulada' ? acc + Number(t.monto_cobrado) : acc, 0);
      const pctRecargo = parseFloat(recargo) || 0;
      const montoRecargo = Math.round(totalCobrado * pctRecargo / 100);
      const totalFinal = totalCobrado + montoRecargo;

      rows.push({ Fecha: '', Socio: '', Legajo: '', 'Total Venta': '' as any, 'Monto Cobrado': totalCobrado, Tipo: 'TOTAL COBRADO', Estado: '' as any });
      if (pctRecargo > 0) {
        rows.push({ Fecha: '', Socio: '', Legajo: '', 'Total Venta': '' as any, 'Monto Cobrado': montoRecargo, Tipo: `Recargo financiero ${pctRecargo}%`, Estado: '' as any });
        rows.push({ Fecha: '', Socio: '', Legajo: '', 'Total Venta': '' as any, 'Monto Cobrado': totalFinal, Tipo: 'TOTAL A LIQUIDAR', Estado: '' as any });
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:G1');
      const totalRows = pctRecargo > 0 ? 3 : 1;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const ref = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[ref]) continue;
          ws[ref].s = { font: { name: 'Arial', sz: 10 }, alignment: { vertical: 'center' } };
          if (R === 0) { ws[ref].s.font = { ...ws[ref].s.font, bold: true, color: { rgb: 'FFFFFF' } }; ws[ref].s.fill = { fgColor: { rgb: '064E3B' } }; ws[ref].s.alignment = { horizontal: 'center', vertical: 'center' }; }
          if (R > range.e.r - totalRows) { ws[ref].s.font = { ...ws[ref].s.font, bold: true, color: { rgb: '065F46' } }; ws[ref].s.fill = { fgColor: { rgb: 'D1FAE5' } }; }
        }
      }
      ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 12 }];

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
      <TopBar title="Historial de ventas" subtitle="Mis cobros" />

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
        {/* ─── FILTROS Y EXPORTACIÓN ─── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-800">Filtros y Cierre mensual</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">+ Recargo %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={recargo}
                  onChange={e => setRecargo(e.target.value)}
                  placeholder="0"
                  className="w-14 bg-transparent text-sm font-bold text-slate-700 outline-none text-right"
                />
              </div>
              <button
                onClick={handleExportar}
                disabled={exporting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
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

        {/* ─── LISTA ─── */}
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
                          <button
                            onClick={() => setEditModal({ open: true, t, newMonto: String(t.monto_total), motivo: '' })}
                            className="text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                          >
                            ✏️ Editar monto
                          </button>
                        )}
                        <button
                          onClick={() => setAnulModal({ open: true, t, motivo: '' })}
                          className="text-xs font-bold px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                        >
                          🗑 Anular
                        </button>
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
                              <span>
                                {dif < 0 ? 'Se devolvió' : 'Se agregó'} <strong>{formatMoney(Math.abs(dif))}</strong> al socio el {formatDate(log.created_at)}
                              </span>
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
      </div>
    </>
  );
}
