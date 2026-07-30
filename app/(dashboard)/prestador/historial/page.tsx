'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Transaccion } from '@/lib/types';
import * as XLSX from 'xlsx-js-style';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function formatDate(d: string) { return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }); }

type EditModal = { open: true; t: Transaccion; newMonto: string; newFecha: string; motivo: string } | { open: false };
type AnulModal = { open: true; t: Transaccion; motivo: string; devolverSaldo: boolean } | { open: false };

export default function PrestadorHistorial() {
  const { user } = useAuth();
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [exporting, setExporting] = useState(false);
  const [recargo, setRecargo] = useState('');
  const [agruparPorSocio, setAgruparPorSocio] = useState(false);
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

  type AnulCuotaModal = { open: true; cuota: CuotaCobrada; motivo: string; nuevoEstado: 'pendiente'|'anulada'; devolverSaldo: boolean } | { open: false };
  const [anulCuotaModal, setAnulCuotaModal] = useState<AnulCuotaModal>({ open: false });

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

      const pctRecargo = parseFloat(recargo) || 0;
      const colLabel = pctRecargo > 0 ? `Precio Act. +${pctRecargo}%` : '';

      // ── Cuotas cobradas ──
      const cuotasParams = new URLSearchParams({ unpaginated: 'true' });
      if (fechaDesde) cuotasParams.append('fecha_desde', fechaDesde);
      if (fechaHasta) cuotasParams.append('fecha_hasta', fechaHasta);
      const resCuotas = await api.get<ApiResponse<any>>(`/prestador/cuotas/cobradas?${cuotasParams.toString()}`);
      const cuotasData: any[] = Array.isArray(resCuotas.data) ? resCuotas.data : resCuotas.data.data || [];
      const totalCuotasCobradas = cuotasData.reduce((acc: number, c: any) => acc + Number(c.monto), 0);

      const totalVentasDirectas = data
        .filter(t => t.estado !== 'anulada' && !t.es_cuotas)
        .reduce((acc, t) => acc + Number(t.monto_total), 0);

      const totalCobrado = totalVentasDirectas + totalCuotasCobradas;
      const montoRecargo = Math.round(totalCobrado * pctRecargo / 100);
      const totalFinal = totalCobrado + montoRecargo;

      const nombrePrestador = (user?.prestador as any)?.nombre ?? user?.name ?? 'Prestador';
      const periodoLabel = fechaDesde && fechaHasta
        ? `${fechaDesde} al ${fechaHasta}`
        : fechaDesde ? `Desde ${fechaDesde}` : fechaHasta ? `Hasta ${fechaHasta}` : 'Período completo';

      // Columnas
      const colHeaders = ['Fecha', 'Socio', 'Legajo', 'Total Venta', 'Monto Cobrado', ...(pctRecargo > 0 ? [colLabel] : []), 'Tipo', 'Estado'];
      const nCols = colHeaders.length;
      const emptyArr = () => Array(nCols).fill('');

      const iMontoTotal = 3;
      const iMontoCobrado = 4;
      const iActualizado = pctRecargo > 0 ? 5 : -1;

      const aoa: any[][] = [];
      const moneyRows: { r: number; cols: number[] }[] = [];

      // Fila 0: Título
      aoa.push([`CIERRE DE VENTAS - ${nombrePrestador.toUpperCase()}`, ...Array(nCols - 1).fill('')]);
      // Fila 1: Período
      aoa.push([`Período: ${periodoLabel}`, ...Array(nCols - 1).fill('')]);
      // Fila 2: vacía
      aoa.push(emptyArr());

      // ── Resumen ──
      const summaryStartR = aoa.length;
      aoa.push(['RESUMEN DEL CIERRE', ...Array(nCols - 1).fill('')]);

      const pushSummaryRow = (label: string, monto: number) => {
        const row = emptyArr();
        row[0] = label;
        row[iMontoCobrado] = monto;
        moneyRows.push({ r: aoa.length, cols: [iMontoCobrado] });
        aoa.push(row);
      };
      pushSummaryRow('Ventas directas (1 pago)', totalVentasDirectas);
      pushSummaryRow('Cuotas cobradas', totalCuotasCobradas);
      pushSummaryRow('TOTAL COBRADO', totalCobrado);
      if (pctRecargo > 0) {
        pushSummaryRow(`Actualización de precios ${pctRecargo}%`, montoRecargo);
        pushSummaryRow('TOTAL A LIQUIDAR', totalFinal);
      }
      const summaryEndR = aoa.length - 1;
      aoa.push(emptyArr());

      // ── Ventas directas ──
      const ventasSubtitleR = aoa.length;

      if (agruparPorSocio) {
        const ventasRows = data.filter(t => !t.es_cuotas && t.estado !== 'anulada');
        // ── Agrupado por socio ──
        aoa.push(['▸ RESUMEN POR SOCIO - VENTAS DIRECTAS', ...Array(nCols - 1).fill('')]);
        const grpHeaders = ['Socio', 'Legajo', 'Cant. Ventas', 'Total', ...(pctRecargo > 0 ? [colLabel] : [])];
        const ventasColHeaderR_grp = aoa.length;
        aoa.push([...grpHeaders, ...Array(Math.max(0, nCols - grpHeaders.length)).fill('')]);

        const socioMap = new Map<string, { nombre: string; legajo: string; total: number; count: number }>();
        ventasRows.forEach(t => {
          const key = t.socio?.legajo ?? 'SIN_LEGAJO';
          const existing = socioMap.get(key);
          if (existing) {
            existing.total += Number(t.monto_total);
            existing.count += 1;
          } else {
            socioMap.set(key, {
              nombre: `${t.socio?.nombre ?? ''} ${t.socio?.apellido ?? ''}`,
              legajo: t.socio?.legajo ?? '',
              total: Number(t.monto_total),
              count: 1,
            });
          }
        });

        socioMap.forEach(s => {
          const row = emptyArr();
          row[0] = s.nombre;
          row[1] = s.legajo;
          row[2] = s.count;
          row[3] = s.total;
          const mCols = [3];
          if (pctRecargo > 0) {
            row[4] = Math.round(s.total * (1 + pctRecargo / 100));
            mCols.push(4);
          }
          moneyRows.push({ r: aoa.length, cols: mCols });
          aoa.push(row);
        });

        // Reusar ventasColHeaderR para estilo
        var ventasColHeaderR = ventasColHeaderR_grp;
      } else {
        // ── Detalle completo ──
        const todasVentasRows = data
          .filter(t => t.estado !== 'anulada' && t.tipo !== 'manual')
          .sort((a, b) => {
            const legA = parseInt(a.socio?.legajo || '0', 10);
            const legB = parseInt(b.socio?.legajo || '0', 10);
            return legA - legB;
          });
          
        aoa.push(['▸ DETALLE DE VENTAS (DIRECTAS Y EN CUOTAS)', ...Array(nCols - 1).fill('')]);
        var ventasColHeaderR = aoa.length;
        aoa.push([...colHeaders]);

        todasVentasRows.forEach(t => {
          const row = emptyArr();
          row[0] = new Date(t.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' });
          row[1] = `${t.socio?.nombre} ${t.socio?.apellido}`;
          row[2] = t.socio?.legajo ?? '';
          row[iMontoTotal] = Number(t.monto_total);
          
          if (t.es_cuotas) {
            row[iMontoCobrado] = 0;
            const primeraCuota = t.cuotas?.slice().sort((a: any, b: any) => a.nro_cuota - b.nro_cuota)[0];
            const mesSig = primeraCuota?.periodo?.nombre || 'Pendiente';
            row[nCols - 2] = `Cuota 1 - ${mesSig}`;
          } else {
            row[iMontoCobrado] = Number(t.monto_cobrado);
            row[nCols - 2] = '1 Pago';
          }
          
          if (pctRecargo > 0) row[iActualizado] = Math.round(Number(t.monto_total) * (1 + pctRecargo / 100));
          row[nCols - 1] = t.estado;
          const mCols = [iMontoTotal, iMontoCobrado, ...(pctRecargo > 0 ? [iActualizado] : [])];
          moneyRows.push({ r: aoa.length, cols: mCols });
          aoa.push(row);
        });
      }

      aoa.push(emptyArr());

      // ── Cuotas cobradas ──
      let cuotasSubtitleR = -1;
      let cuotasColHeaderR = -1;
      if (cuotasData.length > 0) {
        cuotasSubtitleR = aoa.length;

        if (agruparPorSocio) {
          aoa.push(['▸ RESUMEN POR SOCIO - CUOTAS COBRADAS', ...Array(nCols - 1).fill('')]);
          const grpHeadersC = ['Socio', 'Legajo', 'Cant. Cuotas', 'Total Cobrado', ...(pctRecargo > 0 ? [colLabel] : [])];
          cuotasColHeaderR = aoa.length;
          aoa.push([...grpHeadersC, ...Array(Math.max(0, nCols - grpHeadersC.length)).fill('')]);

          const socioMapC = new Map<string, { nombre: string; legajo: string; total: number; count: number }>();
          cuotasData.forEach((c: any) => {
            const key = c.transaccion?.socio?.legajo ?? 'SIN_LEGAJO';
            const existing = socioMapC.get(key);
            if (existing) {
              existing.total += Number(c.monto);
              existing.count += 1;
            } else {
              socioMapC.set(key, {
                nombre: `${c.transaccion?.socio?.nombre ?? ''} ${c.transaccion?.socio?.apellido ?? ''}`,
                legajo: c.transaccion?.socio?.legajo ?? '',
                total: Number(c.monto),
                count: 1,
              });
            }
          });

          socioMapC.forEach(s => {
            const row = emptyArr();
            row[0] = s.nombre;
            row[1] = s.legajo;
            row[2] = s.count;
            row[3] = s.total;
            const mCols = [3];
            if (pctRecargo > 0) {
              row[4] = Math.round(s.total * (1 + pctRecargo / 100));
              mCols.push(4);
            }
            moneyRows.push({ r: aoa.length, cols: mCols });
            aoa.push(row);
          });
        } else {
          aoa.push(['▸ DETALLE DE CUOTAS COBRADAS', ...Array(nCols - 1).fill('')]);
          cuotasColHeaderR = aoa.length;
          aoa.push([...colHeaders]);
          cuotasData.forEach((c: any) => {
            const row = emptyArr();
            row[0] = new Date(c.cobrada_en).toLocaleDateString('es-AR');
            row[1] = `${c.transaccion?.socio?.nombre} ${c.transaccion?.socio?.apellido}`;
            row[2] = c.transaccion?.socio?.legajo ?? '';
            row[iMontoTotal] = Number(c.transaccion?.monto_total ?? 0);
            row[iMontoCobrado] = Number(c.monto);
            row[nCols - 2] = `Cuota ${c.nro_cuota} - ${c.periodo?.nombre ?? ''}`;
            row[nCols - 1] = 'cobrada';
            moneyRows.push({ r: aoa.length, cols: [iMontoTotal, iMontoCobrado] });
            aoa.push(row);
          });
        }
      }

      // ── Worksheet ──
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const totalRows = aoa.length;

      // Estilos base
      for (let R = 0; R < totalRows; ++R) {
        for (let C = 0; C < nCols; ++C) {
          const ref = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[ref]) ws[ref] = { v: '', t: 's' };
          ws[ref].s = { font: { name: 'Calibri', sz: 10 }, alignment: { vertical: 'center' } };
        }
      }

      const applyRow = (r: number, s: any) => {
        for (let C = 0; C < nCols; ++C) {
          const ref = XLSX.utils.encode_cell({ r, c: C });
          if (!ws[ref]) ws[ref] = { v: '', t: 's' };
          ws[ref].s = { ...ws[ref].s, ...s };
        }
      };

      // Título prestador
      applyRow(0, { font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '064E3B' } }, alignment: { horizontal: 'center', vertical: 'center' } });
      // Período
      applyRow(1, { font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '065F46' } }, fill: { fgColor: { rgb: 'ECFDF5' } } });
      // Resumen verde claro
      for (let R = summaryStartR; R <= summaryEndR; ++R) {
        applyRow(R, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '065F46' } }, fill: { fgColor: { rgb: 'D1FAE5' } } });
      }
      // RESUMEN DEL CIERRE y TOTAL COBRADO/LIQUIDAR en verde oscuro
      applyRow(summaryStartR, { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '064E3B' } } });
      applyRow(summaryEndR, { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '064E3B' } } });
      // Subtítulos de sección azul claro
      [ventasSubtitleR, cuotasSubtitleR].filter(r => r >= 0).forEach(r =>
        applyRow(r, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E3A5F' } }, fill: { fgColor: { rgb: 'DBEAFE' } } })
      );
      // Cabeceras de columna azul oscuro
      [ventasColHeaderR, cuotasColHeaderR].filter(r => r >= 0).forEach(r =>
        applyRow(r, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F4E79' } }, alignment: { horizontal: 'center', vertical: 'center' } })
      );

      // Formato moneda $
      const moneyFmt = '"$"#,##0';
      moneyRows.forEach(({ r, cols }) => {
        cols.forEach(c => {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (ws[ref] && typeof ws[ref].v === 'number') {
            ws[ref].t = 'n';
            ws[ref].z = moneyFmt;
          }
        });
      });

      // Anchos de columna
      const colWidths = [{ wch: 22 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
      if (pctRecargo > 0) colWidths.push({ wch: 18 });
      colWidths.push({ wch: 22 }, { wch: 12 });
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cierre');
      const desde = fechaDesde || 'inicio';
      const hasta = fechaHasta || 'hoy';
      XLSX.writeFile(wb, `Cierre_${nombrePrestador}_${desde}_al_${hasta}.xlsx`);
    } catch (e) {
      console.error(e);
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
        fecha_creacion: editModal.newFecha,
      });
      setEditModal({ open: false });
      fetchData(page);
    } catch (err: any) {
      alert(err?.message || 'Error al editar.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAnular = async () => {
    if (!anulModal.open) return;
    if (!anulModal.motivo.trim()) return alert('El motivo es obligatorio.');
    setSaving(true);
    try {
      await api.post(`/prestador/transacciones/${anulModal.t.id}/anular`, { 
        motivo_anulacion: anulModal.motivo,
        devolver_saldo: anulModal.devolverSaldo
      });
      setAnulModal({ open: false });
      fetchData(page);
    } catch (err: any) {
      alert(err?.message || 'Error al anular.');
    } finally {
      setSaving(false);
    }
  };

  // ─── ANULAR CUOTA ─────────────────────────────────────────────
  const handleConfirmAnularCuota = async () => {
    if (!anulCuotaModal.open) return;
    if (!anulCuotaModal.motivo.trim()) return alert('El motivo es obligatorio.');
    setSaving(true);
    try {
      await api.post(`/prestador/cuotas/${anulCuotaModal.cuota.id}/anular`, {
        motivo_anulacion: anulCuotaModal.motivo,
        devolver_saldo: anulCuotaModal.devolverSaldo,
        nuevo_estado: anulCuotaModal.nuevoEstado
      });
      setAnulCuotaModal({ open: false });
      fetchCuotas(cuotasPage);
    } catch (err: any) {
      alert(err?.message || 'Error al anular cuota.');
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
            <h3 className="text-lg font-black text-slate-800 mb-1">Editar Venta</h3>
            <p className="text-sm text-slate-500 mb-4">
              {editModal.t.socio?.nombre} {editModal.t.socio?.apellido} · Monto actual: <strong>{formatMoney(editModal.t.monto_total)}</strong>
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nueva Fecha <span className="font-normal text-[10px]">(Opcional)</span></label>
                <input
                  type="datetime-local"
                  value={editModal.newFecha}
                  onChange={e => setEditModal({ ...editModal, newFecha: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nuevo monto</label>
                <input
                  type="number"
                  value={editModal.newMonto}
                  onChange={e => setEditModal({ ...editModal, newMonto: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
                  placeholder="0"
                />
              </div>
            </div>
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
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-red-400 mb-3 resize-none"
              placeholder="Ej: El socio presentó receta con descuento del 40%..."
            />
            
            <div className="flex items-center gap-2 mb-4 bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <input type="checkbox" id="devolverSaldoVenta" checked={anulModal.devolverSaldo} onChange={e => setAnulModal({ ...anulModal, devolverSaldo: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
              <label htmlFor="devolverSaldoVenta" className="text-sm font-medium text-slate-700 select-none cursor-pointer">Devolver saldo al socio</label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setAnulModal({ open: false })} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleConfirmAnular} disabled={saving} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50">
                {saving ? 'Anulando...' : 'Anular venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ANULAR CUOTA ─── */}
      {anulCuotaModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-black text-slate-800 mb-1">Anular cobro de cuota</h3>
            <p className="text-sm text-slate-500 mb-4">
              {anulCuotaModal.cuota.transaccion?.socio?.nombre} {anulCuotaModal.cuota.transaccion?.socio?.apellido} · Cuota {anulCuotaModal.cuota.nro_cuota} ({formatMoney(anulCuotaModal.cuota.monto)})
            </p>

            <label className="block text-xs font-bold text-slate-500 mb-1">¿Qué hacer con la cuota?</label>
            <select
              value={anulCuotaModal.nuevoEstado}
              onChange={e => setAnulCuotaModal({ ...anulCuotaModal, nuevoEstado: e.target.value as 'pendiente' | 'anulada' })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-red-400 mb-3"
            >
              <option value="pendiente">Volver a pendiente (se podrá cobrar después)</option>
              <option value="anulada">Anular definitivamente (baja total)</option>
            </select>

            <label className="block text-xs font-bold text-slate-500 mb-1">Motivo <span className="text-red-500">*</span></label>
            <textarea
              value={anulCuotaModal.motivo}
              onChange={e => setAnulCuotaModal({ ...anulCuotaModal, motivo: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-red-400 mb-3 resize-none"
              placeholder="Ej: Cobro duplicado por error..."
            />

            <div className="flex items-center gap-2 mb-4 bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <input type="checkbox" id="devolverSaldoCuota" checked={anulCuotaModal.devolverSaldo} onChange={e => setAnulCuotaModal({ ...anulCuotaModal, devolverSaldo: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
              <label htmlFor="devolverSaldoCuota" className="text-sm font-medium text-slate-700 select-none cursor-pointer">Devolver saldo al socio</label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setAnulCuotaModal({ open: false })} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={handleConfirmAnularCuota} disabled={saving} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50">
                {saving ? 'Procesando...' : 'Confirmar anulación'}
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
                  <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 cursor-pointer select-none">
                    <div className={`relative w-9 h-5 rounded-full transition-colors ${agruparPorSocio ? 'bg-emerald-500' : 'bg-slate-300'}`} onClick={() => setAgruparPorSocio(!agruparPorSocio)}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${agruparPorSocio ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Agrupar por socio</span>
                  </label>
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
                              <button onClick={() => setEditModal({ open: true, t, newMonto: String(t.monto_total), newFecha: '', motivo: '' })} className="text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">✏️ Editar</button>
                            )}
                            <button onClick={() => setAnulModal({ open: true, t, motivo: '', devolverSaldo: true })} className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors">
                              Anular
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
                              const antesMonto = Number(log.valores_antes.monto_total || 0);
                              const despuesMonto = Number(log.valores_despues.monto_total || 0);
                              const dif = despuesMonto - antesMonto;
                              
                              const antesFecha = log.valores_antes.created_at;
                              const despuesFecha = log.valores_despues.created_at;
                              const fechaCambiada = antesFecha && despuesFecha && antesFecha !== despuesFecha;
                              
                              return (
                                <div key={log.id} className="text-xs text-slate-500 flex flex-col gap-1 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                  {dif !== 0 && (
                                    <p className="flex items-center gap-1.5">
                                      <span className="text-sm">{dif < 0 ? '↘️' : '↗️'}</span>
                                      <span>{dif < 0 ? 'Se devolvió' : 'Se agregó'} <strong>{formatMoney(Math.abs(dif))}</strong> al socio el {formatDate(log.created_at)}</span>
                                    </p>
                                  )}
                                  {fechaCambiada && (
                                    <p className="flex items-center gap-1.5">
                                      <span className="text-sm">📅</span>
                                      <span>Se cambió la fecha del <strong>{formatDate(antesFecha)}</strong> al <strong>{formatDate(despuesFecha)}</strong></span>
                                    </p>
                                  )}
                                  {dif === 0 && !fechaCambiada && (
                                    <p className="flex items-center gap-1.5">
                                      <span className="text-sm">📝</span>
                                      <span>Venta editada el {formatDate(log.created_at)}</span>
                                    </p>
                                  )}
                                </div>
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
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <p className="text-sm font-black text-indigo-600">+{formatMoney(c.monto)}</p>
                        <p className="text-[10px] text-slate-400 mb-1">Venta: {formatMoney(c.transaccion?.monto_total)}</p>
                        <button onClick={() => setAnulCuotaModal({ open: true, cuota: c, motivo: '', nuevoEstado: 'pendiente', devolverSaldo: true })} className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors">
                          Anular pago
                        </button>
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
