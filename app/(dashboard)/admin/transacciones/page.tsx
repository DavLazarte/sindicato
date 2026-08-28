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
  const [agruparPorSocio, setAgruparPorSocio] = useState(false);

  // ── Resumen por negocio ──
  const [resumenModal, setResumenModal] = useState(false);
  const [resumenDesde, setResumenDesde] = useState('');
  const [resumenHasta, setResumenHasta] = useState('');
  const [resumenData, setResumenData] = useState<{id: number; nombre: string; totalVentas: number; totalCuotas: number; total: number}[]>([]);
  const [resumenTxs, setResumenTxs] = useState<Transaccion[]>([]);
  const [resumenCuotas, setResumenCuotas] = useState<any[]>([]);
  const [recargosPorPrestador, setRecargosPorPrestador] = useState<Record<number, number>>({});
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

  const generateMultiSheetExcel = (
    allTx: Transaccion[],
    allCuotas: any[],
    fechaDesde: string,
    fechaHasta: string,
    recargosMap: Record<number, number>,
    agruparPorSocio: boolean,
    fileNamePrefix: string
  ) => {
    const periodoLabel = fechaDesde && fechaHasta
      ? `${fechaDesde} al ${fechaHasta}`
      : fechaDesde ? `Desde ${fechaDesde}` : fechaHasta ? `Hasta ${fechaHasta}` : 'Período completo';

    const applyStyles = (ws: any, totalRows: number, nCols: number) => {
      for (let R = 0; R < totalRows; ++R) {
        for (let C = 0; C < nCols; ++C) {
          const ref = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[ref]) ws[ref] = { v: '', t: 's' };
          ws[ref].s = { font: { name: 'Calibri', sz: 10 }, alignment: { vertical: 'center' } };
        }
      }
    };
    const styleRow = (ws: any, r: number, nCols: number, s: any) => {
      for (let C = 0; C < nCols; ++C) {
        const ref = XLSX.utils.encode_cell({ r, c: C });
        if (!ws[ref]) ws[ref] = { v: '', t: 's' };
        ws[ref].s = { ...ws[ref].s, ...s };
      }
    };

    const prestadorMap = new Map<number, { nombre: string; txs: Transaccion[]; cuotas: any[] }>();

    allTx.forEach(t => {
      const pid = t.prestador?.id ?? 0;
      if (!prestadorMap.has(pid)) prestadorMap.set(pid, { nombre: t.prestador?.nombre ?? 'Sin nombre', txs: [], cuotas: [] });
      prestadorMap.get(pid)!.txs.push(t);
    });

    allCuotas.filter((c: any) => c.estado === 'cobrada').forEach((c: any) => {
      const pid = c.transaccion?.prestador?.id ?? 0;
      const nombre = c.transaccion?.prestador?.nombre ?? 'Sin nombre';
      if (!prestadorMap.has(pid)) prestadorMap.set(pid, { nombre, txs: [], cuotas: [] });
      prestadorMap.get(pid)!.cuotas.push(c);
    });

    const wb = XLSX.utils.book_new();
    const resumenRows: { nombre: string; ventas: number; cuotas: number; total: number; recargoPct: number; actualizado: number }[] = [];

    prestadorMap.forEach((pData, pid) => {
      const recargoPct = recargosMap[pid] || 0;
      const colLabel = recargoPct > 0 ? `Precio Act. +${recargoPct}%` : '';

      const ventasDirectas = pData.txs.filter(t => !t.es_cuotas && t.estado !== 'anulada');
      const totalVentas = ventasDirectas.reduce((a, t) => a + Number(t.monto_total), 0);
      const totalCuotas = pData.cuotas.reduce((a, c) => a + Number(c.monto), 0);
      const totalGeneral = totalVentas + totalCuotas;
      const totalActualizado = totalGeneral * (1 + recargoPct / 100);

      resumenRows.push({ nombre: pData.nombre, ventas: totalVentas, cuotas: totalCuotas, total: totalGeneral, recargoPct, actualizado: totalActualizado });

      const colHeaders = ['Fecha', 'Socio', 'Legajo', 'Total Venta', 'Monto Cobrado', ...(recargoPct > 0 ? [colLabel] : []), 'Tipo', 'Estado'];
      const nCols = colHeaders.length;
      
      const newColHeaders = ['Fecha', 'Legajo', 'Socio', 'Total Cobrado', 'Total Venta', ...(recargoPct > 0 ? [colLabel] : []), 'Tipo', 'Estado'];
      const nNewCols = newColHeaders.length;
      const iNewLegajo = 1;
      const iNewSocio = 2;
      const iNewCobrado = 3;
      const iNewTotal = 4;
      const iNewActualizado = recargoPct > 0 ? 5 : -1;
      
      const emptyNewArr = () => Array(nNewCols).fill('');
      const aoa: any[][] = [];
      const moneyRows: { r: number; cols: number[] }[] = [];

      aoa.push([`${pData.nombre.toUpperCase()}`, ...Array(nNewCols - 1).fill('')]);
      aoa.push([`Período: ${periodoLabel}`, ...Array(nNewCols - 1).fill('')]);
      aoa.push(Array(nNewCols).fill(''));

      const summStart = aoa.length;
      aoa.push(['RESUMEN', ...Array(nNewCols - 1).fill('')]);
      const pushSum = (label: string, monto: number) => {
        const row = emptyNewArr(); row[0] = label; row[iNewCobrado] = monto;
        moneyRows.push({ r: aoa.length, cols: [iNewCobrado] });
        aoa.push(row);
      };
      pushSum('Ventas directas', totalVentas);
      pushSum('Cuotas cobradas', totalCuotas);
      pushSum('TOTAL COBRADO', totalGeneral);
      if (recargoPct > 0) {
        pushSum(`Actualización de precios ${recargoPct}%`, Math.round(totalGeneral * (recargoPct / 100)));
        pushSum('TOTAL A LIQUIDAR', Math.round(totalActualizado));
      }
      const summEnd = aoa.length - 1;
      aoa.push(Array(nNewCols).fill(''));

      const ventasSubR = aoa.length;
      let cuotasSubR = -1;
      let cuotasColHdrR = -1;
      let ventasColHdrR = -1;
      
      const sortByLegajo = (arr: any[], getLegajo: (x: any) => string) =>
        [...arr].sort((a, b) => parseInt(getLegajo(a) || '0', 10) - parseInt(getLegajo(b) || '0', 10));

      if (agruparPorSocio) {
        aoa.push(['▸ RESUMEN POR SOCIO (VENTAS DIRECTAS Y CUOTAS COBRADAS)', ...Array(nNewCols - 1).fill('')]);
        // Nuevo orden: Socio / Legajo / Total Cobrado / Ventas Directas / Cant. Ventas / Cuotas Cobradas / Cant. Cuotas
        const grpH = ['Socio', 'Legajo', 'Total Cobrado', 'Ventas Directas', 'Cant. Ventas', 'Cuotas Cobradas', 'Cant. Cuotas', ...(recargoPct > 0 ? [colLabel] : [])];
        ventasColHdrR = aoa.length;
        aoa.push([...grpH, ...Array(Math.max(0, nNewCols - grpH.length)).fill('')]);

        const sMap = new Map<string, { nombre: string; legajo: string; cVentas: number; tVentas: number; cCuotas: number; tCuotas: number }>();
        
        ventasDirectas.forEach(t => {
          const k = t.socio?.legajo ?? 'SIN';
          const ex = sMap.get(k);
          const apellidoNombre = `${t.socio?.apellido ?? ''}, ${t.socio?.nombre ?? ''}`;
          if (ex) { ex.tVentas += Number(t.monto_total); ex.cVentas++; }
          else sMap.set(k, { nombre: apellidoNombre, legajo: t.socio?.legajo ?? '', cVentas: 1, tVentas: Number(t.monto_total), cCuotas: 0, tCuotas: 0 });
        });
        
        pData.cuotas.forEach((c: any) => {
          const k = c.transaccion?.socio?.legajo ?? 'SIN';
          const ex = sMap.get(k);
          const apellidoNombre = `${c.transaccion?.socio?.apellido ?? ''}, ${c.transaccion?.socio?.nombre ?? ''}`;
          if (ex) { ex.tCuotas += Number(c.monto); ex.cCuotas++; }
          else sMap.set(k, { nombre: apellidoNombre, legajo: c.transaccion?.socio?.legajo ?? '', cVentas: 0, tVentas: 0, cCuotas: 1, tCuotas: Number(c.monto) });
        });

        const sortedEntries = [...sMap.entries()].sort((a, b) => parseInt(a[0] || '0', 10) - parseInt(b[0] || '0', 10));
        sortedEntries.forEach(([, s]) => {
          const total = s.tVentas + s.tCuotas;
          const row = Array(nNewCols).fill('');
          // Socio / Legajo / Total Cobrado / Ventas Directas / Cant. Ventas / Cuotas Cobradas / Cant. Cuotas
          row[0] = s.nombre; row[1] = s.legajo;
          row[2] = total;
          row[3] = s.tVentas; row[4] = s.cVentas;
          row[5] = s.tCuotas; row[6] = s.cCuotas;
          
          const mCols = [2, 3, 5];
          if (recargoPct > 0) { row[7] = Math.round(total * (1 + recargoPct / 100)); mCols.push(7); }
          moneyRows.push({ r: aoa.length, cols: mCols });
          aoa.push(row);
        });

      } else {
        aoa.push(['▸ DETALLE DE VENTAS DIRECTAS', ...Array(nNewCols - 1).fill('')]);
        ventasColHdrR = aoa.length;
        aoa.push([...newColHeaders]);

        sortByLegajo(ventasDirectas, t => t.socio?.legajo ?? '').forEach(t => {
          const row = emptyNewArr();
          row[0] = new Date(t.created_at).toLocaleString('es-AR');
          row[iNewLegajo] = t.socio?.legajo ?? '';
          row[iNewSocio] = `${t.socio?.apellido ?? ''}, ${t.socio?.nombre ?? ''}`;
          row[iNewCobrado] = Number(t.monto_cobrado);
          row[iNewTotal] = Number(t.monto_total);
          if (recargoPct > 0) row[iNewActualizado] = Math.round(Number(t.monto_total) * (1 + recargoPct / 100));
          row[nNewCols - 2] = t.tipo === 'manual' ? 'Carga manual' : '1 Pago';
          row[nNewCols - 1] = t.estado;
          const mCols = [iNewCobrado, iNewTotal, ...(recargoPct > 0 ? [iNewActualizado] : [])];
          moneyRows.push({ r: aoa.length, cols: mCols });
          aoa.push(row);
        });
        aoa.push(emptyNewArr());

        if (pData.cuotas.length > 0) {
          cuotasSubR = aoa.length;
          aoa.push(['▸ DETALLE DE CUOTAS COBRADAS', ...Array(nNewCols - 1).fill('')]);
          cuotasColHdrR = aoa.length;
          aoa.push([...newColHeaders]);

          sortByLegajo(pData.cuotas, (c: any) => c.transaccion?.socio?.legajo ?? '').forEach((c: any) => {
            const row = emptyNewArr();
            row[0] = new Date(c.cobrada_en).toLocaleDateString('es-AR');
            row[iNewLegajo] = c.transaccion?.socio?.legajo ?? '';
            row[iNewSocio] = `${c.transaccion?.socio?.apellido ?? ''}, ${c.transaccion?.socio?.nombre ?? ''}`;
            row[iNewCobrado] = Number(c.monto);
            row[iNewTotal] = Number(c.transaccion?.monto_total ?? 0);
            if (recargoPct > 0) row[iNewActualizado] = Math.round(Number(c.monto) * (1 + recargoPct / 100));
            row[nNewCols - 2] = `Cuota ${c.nro_cuota}`;
            row[nNewCols - 1] = 'cobrada';
            const mCols = [iNewCobrado, iNewTotal, ...(recargoPct > 0 ? [iNewActualizado] : [])];
            moneyRows.push({ r: aoa.length, cols: mCols });
            aoa.push(row);
          });
        }
      }

      const nStyles = agruparPorSocio ? nCols : nNewCols;
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      applyStyles(ws, aoa.length, nStyles);
      styleRow(ws, 0, nStyles, { font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '064E3B' } }, alignment: { horizontal: 'center', vertical: 'center' } });
      styleRow(ws, 1, nStyles, { font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '065F46' } }, fill: { fgColor: { rgb: 'ECFDF5' } } });
      for (let R = summStart; R <= summEnd; ++R)
        styleRow(ws, R, nStyles, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '065F46' } }, fill: { fgColor: { rgb: 'D1FAE5' } } });
      styleRow(ws, summStart, nStyles, { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '064E3B' } } });
      styleRow(ws, summEnd, nStyles, { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '064E3B' } } });
      
      [ventasSubR, cuotasSubR].filter(r => r >= 0).forEach(r =>
        styleRow(ws, r, nStyles, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E3A5F' } }, fill: { fgColor: { rgb: 'DBEAFE' } } })
      );
      [ventasColHdrR, cuotasColHdrR].filter(r => r >= 0).forEach(r =>
        styleRow(ws, r, nStyles, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F4E79' } }, alignment: { horizontal: 'center', vertical: 'center' } })
      );

      moneyRows.forEach(({ r, cols }) => {
        cols.forEach(c => {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (ws[ref] && typeof ws[ref].v === 'number') {
            ws[ref].t = 'n';
            ws[ref].z = '"$"#,##0';
            ws[ref].s = { ...ws[ref].s, alignment: { horizontal: 'left', vertical: 'center' } };
          }
        });
      });
      // Anchos columnas nuevo orden: Fecha / Legajo / Socio / Total Cobrado / Total Venta / [Actualizado] / Tipo / Estado
      const colWidths = [{ wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 16 }, { wch: 16 }];
      if (recargoPct > 0) colWidths.push({ wch: 18 });
      colWidths.push({ wch: 18 }, { wch: 12 });
      ws['!cols'] = colWidths;

      const sheetName = pData.nombre.replace(/[\\/*?:[\]]/g, '').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // ── Hoja RESUMEN GENERAL ──
    const hasAnyRecargo = Object.values(recargosMap).some(r => r > 0);
    const rNcols = hasAnyRecargo ? 6 : 4;
    const rAoa: any[][] = [];
    rAoa.push(['RESUMEN GENERAL POR NEGOCIO', ...Array(rNcols - 1).fill('')]);
    rAoa.push([`Período: ${periodoLabel}`, ...Array(rNcols - 1).fill('')]);
    rAoa.push(Array(rNcols).fill(''));
    
    const rHeaders = ['Negocio', 'Ventas Directas', 'Cuotas Cobradas', 'Total Cobrado'];
    if (hasAnyRecargo) { rHeaders.push('Actualización de precios', 'Total a Liquidar'); }
    rAoa.push(rHeaders);

    const rMoneyRows: { r: number; cols: number[] }[] = [];
    resumenRows.sort((a, b) => b.total - a.total).forEach(r => {
      const row = [r.nombre, r.ventas, r.cuotas, r.total];
      const mCols = [1, 2, 3];
      if (hasAnyRecargo) { row.push(`${r.recargoPct}%`); row.push(Math.round(r.actualizado)); mCols.push(5); }
      rMoneyRows.push({ r: rAoa.length, cols: mCols });
      rAoa.push(row);
    });

    const totV = resumenRows.reduce((a, r) => a + r.ventas, 0);
    const totC = resumenRows.reduce((a, r) => a + r.cuotas, 0);
    const totG = totV + totC;
    const totAct = resumenRows.reduce((a, r) => a + r.actualizado, 0);
    
    const lastRow = ['TOTAL GENERAL', totV, totC, totG];
    const lastMcols = [1, 2, 3];
    if (hasAnyRecargo) { lastRow.push(''); lastRow.push(Math.round(totAct)); lastMcols.push(5); }
    
    rMoneyRows.push({ r: rAoa.length, cols: lastMcols });
    rAoa.push(lastRow);

    const wsR = XLSX.utils.aoa_to_sheet(rAoa);
    applyStyles(wsR, rAoa.length, rNcols);
    styleRow(wsR, 0, rNcols, { font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '064E3B' } }, alignment: { horizontal: 'center', vertical: 'center' } });
    styleRow(wsR, 1, rNcols, { font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '065F46' } }, fill: { fgColor: { rgb: 'ECFDF5' } } });
    styleRow(wsR, 3, rNcols, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F4E79' } }, alignment: { horizontal: 'center', vertical: 'center' } });
    styleRow(wsR, rAoa.length - 1, rNcols, { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '064E3B' } } });
    rMoneyRows.forEach(({ r, cols }) => {
      cols.forEach(c => {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (wsR[ref] && typeof wsR[ref].v === 'number') { wsR[ref].t = 'n'; wsR[ref].z = '"$"#,##0'; }
      });
    });
    const rwColWidths = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    if (hasAnyRecargo) { rwColWidths.push({ wch: 12 }, { wch: 18 }); }
    wsR['!cols'] = rwColWidths;

    XLSX.utils.book_append_sheet(wb, wsR, 'Resumen General');
    const sheetNames = wb.SheetNames;
    const last = sheetNames.pop()!;
    sheetNames.unshift(last);
    wb.SheetNames = sheetNames;

    const desde = fechaDesde || 'inicio';
    const hasta = fechaHasta || 'hoy';
    XLSX.writeFile(wb, `${fileNamePrefix}_${desde}_al_${hasta}.xlsx`);
  };

  const handleExportar = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ unpaginated: '1' });
      if (search) params.append('search', search);
      if (periodoId) params.append('periodo_id', periodoId);
      if (prestadorId) params.append('prestador_id', prestadorId);
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);
      if (estado) params.append('estado', estado);

      const [resTx, resCuotas] = await Promise.all([
        api.get<ApiResponse<any>>(`/admin/transacciones?${params.toString()}`),
        api.get<ApiResponse<any>>(`/admin/cuotas?unpaginated=true${fechaDesde ? `&fecha_desde=${fechaDesde}` : ''}${fechaHasta ? `&fecha_hasta=${fechaHasta}` : ''}`),
      ]);
      const allTx: Transaccion[] = Array.isArray(resTx.data) ? resTx.data : resTx.data.data || [];
      const allCuotas: any[] = Array.isArray(resCuotas.data) ? resCuotas.data : resCuotas.data.data || [];

      generateMultiSheetExcel(allTx, allCuotas, fechaDesde, fechaHasta, {}, agruparPorSocio, 'Reporte_General');
    } catch (err) {
      console.error(err);
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
      const params = new URLSearchParams({ unpaginated: '1', fecha_desde: resumenDesde, fecha_hasta: resumenHasta });
      const res = await api.get<ApiResponse<any>>(`/admin/transacciones?${params.toString()}`);
      const txData: Transaccion[] = Array.isArray(res.data) ? res.data : res.data.data || [];

      const cuotasRes = await api.get<ApiResponse<any>>(`/admin/cuotas?unpaginated=true&fecha_desde=${resumenDesde}&fecha_hasta=${resumenHasta}`);
      const cuotasData: any[] = Array.isArray(cuotasRes.data) ? cuotasRes.data : cuotasRes.data.data || [];

      setResumenTxs(txData);
      setResumenCuotas(cuotasData);

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

      const rows = Object.entries(mapa)
        .map(([id, r]) => ({ id: Number(id), ...r, total: r.totalVentas + r.totalCuotas }))
        .sort((a, b) => b.total - a.total);

      setResumenData(rows);
      setRecargosPorPrestador({});
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
      generateMultiSheetExcel(resumenTxs, resumenCuotas, resumenDesde, resumenHasta, recargosPorPrestador, agruparPorSocio, 'Liquidacion_Negocios');
    } catch (e) {
      console.error(e);
      alert('Error al exportar el resumen.');
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
                        <th className="text-right px-5 py-3 font-bold text-slate-600">Subtotal</th>
                        <th className="text-right px-5 py-3 font-bold text-slate-600">Act. %</th>
                        <th className="text-right px-5 py-3 font-bold text-slate-600">Total Liquidar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {resumenData.map((r, i) => {
                        const recargo = recargosPorPrestador[r.id] || 0;
                        const actualizado = r.total * (1 + recargo / 100);
                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-700">{r.nombre}</td>
                            <td className="px-5 py-3 text-right text-slate-500">{r.totalVentas > 0 ? formatMoney(r.totalVentas) : <span className="text-slate-300">-</span>}</td>
                            <td className="px-5 py-3 text-right text-slate-500">{r.totalCuotas > 0 ? formatMoney(r.totalCuotas) : <span className="text-slate-300">-</span>}</td>
                            <td className="px-5 py-3 text-right font-bold text-slate-700">{formatMoney(r.total)}</td>
                            <td className="px-5 py-2 text-right">
                              <input
                                type="number"
                                min="0" max="100" step="0.5"
                                value={recargosPorPrestador[r.id] || ''}
                                onChange={e => setRecargosPorPrestador({ ...recargosPorPrestador, [r.id]: Number(e.target.value) })}
                                placeholder="0"
                                className="w-16 px-2 py-1 text-right text-sm font-bold text-emerald-600 bg-white border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="px-5 py-3 text-right font-black text-emerald-700">{formatMoney(actualizado)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                        <td className="px-5 py-3 font-black text-emerald-800">TOTAL GENERAL</td>
                        <td className="px-5 py-3 text-right font-black text-emerald-800">{formatMoney(resumenData.reduce((a, r) => a + r.totalVentas, 0))}</td>
                        <td className="px-5 py-3 text-right font-black text-emerald-800">{formatMoney(resumenData.reduce((a, r) => a + r.totalCuotas, 0))}</td>
                        <td className="px-5 py-3 text-right font-black text-slate-700">{formatMoney(resumenData.reduce((a, r) => a + r.total, 0))}</td>
                        <td className="px-5 py-3"></td>
                        <td className="px-5 py-3 text-right font-black text-emerald-800">{formatMoney(resumenData.reduce((a, r) => a + (r.total * (1 + (recargosPorPrestador[r.id] || 0) / 100)), 0))}</td>
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
            <div className="flex gap-2 flex-wrap items-center">
              <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 cursor-pointer select-none">
                <div className={`relative w-9 h-5 rounded-full transition-colors ${agruparPorSocio ? 'bg-emerald-500' : 'bg-slate-300'}`} onClick={() => setAgruparPorSocio(!agruparPorSocio)}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${agruparPorSocio ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Agrupar por socio</span>
              </label>
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
