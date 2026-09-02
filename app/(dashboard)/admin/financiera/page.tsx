'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import * as XLSX from 'xlsx-js-style';
import type { ApiResponse, PaginatedData, Socio, Prestamo, Periodo, ReporteFinancieraRow } from '@/lib/types';

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
  const [periodoInicioId, setPeriodoInicioId] = useState<number | ''>('');
  const [observaciones, setObservaciones] = useState('');
  const [creando, setCreando] = useState(false);

  // === ESTADO LISTA ===
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [searchLista, setSearchLista] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState(''); // '' | 'vigente' | 'finalizado' | 'cancelado'
  const [cargandoLista, setCargandoLista] = useState(true);

  // === ESTADO MODAL COBRO MASIVO ===
  const [showModalCobro, setShowModalCobro] = useState(false);
  const [periodoCobro, setPeriodoCobro] = useState<number | ''>('');
  const [cobrandoMasivo, setCobrandoMasivo] = useState(false);

  // === ESTADO MODAL REPORTE ===
  const [showModalReporte, setShowModalReporte] = useState(false);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<number | ''>('');
  const [reporteData, setReporteData] = useState<ReporteFinancieraRow[]>([]);
  const [cargandoReporte, setCargandoReporte] = useState(false);

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

  // Cargar periodos para el modal
  useEffect(() => {
    api.get<ApiResponse<Periodo[]>>('/admin/periodos').then(res => {
      setPeriodos(res.data);
      if (res.data.length > 0) {
        setPeriodoSeleccionado(res.data[0].id);
      }
    });
  }, []);

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
        observaciones,
        ...(periodoInicioId ? { periodo_inicio_id: periodoInicioId } : {})
      });
      alert('✅ Préstamo creado exitosamente');
      setSocioSeleccionado(null);
      setMontoTotal('');
      setCantidadCuotas(1);
      setPeriodoInicioId('');
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

  const handleCobroMasivo = async () => {
    if (!periodoCobro) return;
    if (!confirm('¿Estás seguro de marcar TODAS las cuotas PENDIENTES de este período como PAGADAS?')) return;
    
    try {
      setCobrandoMasivo(true);
      const res = await api.post<ApiResponse<{message: string}>>(`/admin/prestamos/cuotas/cobrar-masivo`, { periodo_id: periodoCobro });
      alert('✅ ' + (res.data.message || 'Cuotas cobradas correctamente.'));
      setShowModalCobro(false);
      fetchPrestamos(page);
    } catch (err: unknown) {
      alert('Error al cobrar masivamente: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setCobrandoMasivo(false);
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

  // === REPORTE EXCEL ===
  const cargarReporte = async () => {
    if (!periodoSeleccionado) return;
    setCargandoReporte(true);
    try {
      const res = await api.get<ApiResponse<ReporteFinancieraRow[]>>(`/admin/prestamos/reporte?periodo_id=${periodoSeleccionado}`);
      setReporteData(res.data);
    } catch (err: unknown) {
      alert('Error al generar el reporte: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setCargandoReporte(false);
    }
  };

  const descargarExcel = () => {
    if (reporteData.length === 0) return alert('No hay datos para exportar');
    
    const periodoNombre = periodos.find(p => p.id === periodoSeleccionado)?.nombre || '';
    
    // Calcular total general
    const sumTotal = reporteData.reduce((acc, row) => acc + row.total_a_descontar, 0);

    // Preparar detalles separados — ordenados descendente (3/3 primero, luego 2/3, luego 1/3)
    let maxDetalles = 0;
    const parsedData = reporteData.map(row => {
      const detalles = row.detalle
        ? row.detalle.split(' | ').sort((a: string, b: string) => {
            const nroA = parseInt(a.match(/Cuota (\d+)\//)?.[1] || '0', 10);
            const nroB = parseInt(b.match(/Cuota (\d+)\//)?.[1] || '0', 10);
            return nroB - nroA; // descendente: 3/3 → 2/3 → 1/3
          })
        : [];
      if (detalles.length > maxDetalles) maxDetalles = detalles.length;
      return { ...row, detallesArray: detalles };
    });

    // Construir matriz de datos (Array de Arrays)
    const aoa: any[][] = [];
    
    // Fila 0: Titulo
    aoa.push([`REPORTE DE PRÉSTAMOS - ${periodoNombre}`]);
    
    // Fila 1: Total General
    aoa.push(['TOTAL GENERAL A DESCONTAR:', sumTotal]);
    
    // Fila 2: Espacio
    aoa.push([]);

    // Fila 3: Cabeceras — Socio / Legajo / Total / Detalles
    const headers = ['Socio', 'Legajo', 'Total a Descontar'];
    for (let i = 0; i < maxDetalles; i++) headers.push(`Detalle Cuota ${i+1}`);
    aoa.push(headers);

    // Fila 4+: Datos
    parsedData.forEach(row => {
      const rowData = [row.nombre_completo, row.legajo, row.total_a_descontar, ...row.detallesArray];
      aoa.push(rowData);
    });

    // Crear libro y hoja
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Formateo / Estilos
    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = { c: C, r: R };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        if (!ws[cellRef]) continue;

        ws[cellRef].s = {
          font: { name: "Arial", sz: 10 },
          alignment: { vertical: "center" }
        };

        // Fila 0: Título principal
        if (R === 0 && C === 0) {
          ws[cellRef].s.font = { name: "Arial", sz: 14, bold: true, color: { rgb: "1E293B" } };
          ws[cellRef].s.alignment = { horizontal: "left", vertical: "center" };
        }

        // Fila 1: Total General
        if (R === 1) {
          ws[cellRef].s.font = { name: "Arial", sz: 12, bold: true };
          if (C === 1) {
             ws[cellRef].s.font.color = { rgb: "047857" }; // Verde
             ws[cellRef].z = '"$"#,##0.00'; // Formato moneda
          }
        }

        // Fila 3: Cabeceras de tabla
        if (R === 3) {
          ws[cellRef].s.font.bold = true;
          ws[cellRef].s.font.color = { rgb: "FFFFFF" };
          ws[cellRef].s.fill = { fgColor: { rgb: "334155" } }; // Pizarra
          ws[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
        }

        // Filas de Datos
        if (R >= 4) {
          // Columna 1: Legajo — alineado a la derecha
          if (C === 1) {
            ws[cellRef].s.alignment = { horizontal: 'right', vertical: 'center' };
          }
          // Columna 2: Total a Descontar
          if (C === 2) {
             ws[cellRef].s.font.bold = true;
             ws[cellRef].z = '"$"#,##0.00';
          }
          // Columnas >= 3: Detalles (Celdas pintadas de verde)
          if (C >= 3 && ws[cellRef].v) {
             ws[cellRef].s.fill = { fgColor: { rgb: "D1FAE5" } }; // Verde claro
             ws[cellRef].s.font.color = { rgb: "065F46" }; // Verde oscuro
             ws[cellRef].s.font.bold = true;
             ws[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
             ws[cellRef].s.border = {
                top: { style: 'thin', color: { rgb: 'A7F3D0' } },
                bottom: { style: 'thin', color: { rgb: 'A7F3D0' } },
                left: { style: 'thin', color: { rgb: 'A7F3D0' } },
                right: { style: 'thin', color: { rgb: 'A7F3D0' } }
             };
          }
        }
      }
    }

    // Unir celdas para Título y alinear columnas
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }); // Título ocupa todo
    ws['!merges'].push({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }); // Total se expande un poco

    // Ajustar anchos — nuevo orden: Socio / Legajo / Total / Detalles
    const wscols = [
      {wch: 40}, // Socio (ancho)
      {wch: 10}, // Legajo (angosto)
      {wch: 20}, // Total
    ];
    for (let i = 0; i < maxDetalles; i++) {
      wscols.push({wch: 35}); // Cada cuota ocupa su propia celda ancha
    }
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Reporte Financiera");
    XLSX.writeFile(wb, `Reporte_Prestamos_${periodoNombre || periodoSeleccionado}.xlsx`);
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
                  {[1, 2, 3, 4, 5, 6].map(n => (
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

              {/* Período de inicio (opcional — por defecto el actual) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Período de inicio
                  <span className="ml-2 text-[10px] font-normal normal-case text-slate-400">(dejar vacío = período actual)</span>
                </label>
                <select
                  value={periodoInicioId}
                  onChange={(e) => setPeriodoInicioId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  <option value="">— Período actual (automático) —</option>
                  {periodos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                {periodoInicioId && (
                  <p className="mt-1.5 text-xs text-amber-600 font-medium">
                    ⚠️ La cuota 1 se asignará al período seleccionado
                  </p>
                )}
              </div>

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
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-black text-slate-800">Listado de Préstamos</h2>
              <div className="flex flex-wrap items-center gap-3">
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
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 text-slate-700 w-full sm:w-36"
                >
                  <option value="">Todos</option>
                  <option value="vigente">Vigentes</option>
                  <option value="finalizado">Finalizados</option>
                  <option value="cancelado">Cancelados</option>
                </select>
                <button 
                  onClick={() => setShowModalCobro(true)}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold shadow-md shadow-violet-500/20 hover:bg-violet-700 transition-colors w-full sm:w-auto"
                >
                  Cobrar Cuotas del Mes
                </button>
                <button 
                  onClick={() => setShowModalReporte(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-colors w-full sm:w-auto"
                >
                  Generar Reporte Excel
                </button>
              </div>
            </div>

            {cargandoLista ? (
              <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
            ) : prestamos.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No hay préstamos registrados para estos filtros</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap">Socio</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap text-right">Total</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap text-center">Estado</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap">Cuotas</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prestamos.map(p => {
                      const cuotasPendientes = p.cuotas_prestamo?.filter(c => c.estado === 'pendiente') || [];
                      
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors align-top">
                          {/* Socio */}
                          <td className="px-4 py-4">
                            <p className="font-bold text-slate-800 whitespace-nowrap">{p.socio?.nombre} {p.socio?.apellido}</p>
                            <p className="text-[10px] font-mono text-slate-500">Legajo: {p.socio?.legajo}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Otorgado: {formatDate(p.created_at)}</p>
                          </td>
                          
                          {/* Total */}
                          <td className="px-4 py-4 text-right">
                            <p className="font-black text-slate-800">{formatMoney(p.monto_total)}</p>
                            <p className="text-[10px] font-bold text-slate-500 mt-1">{p.cantidad_cuotas}x {formatMoney(p.monto_cuota)}</p>
                          </td>
                          
                          {/* Estado */}
                          <td className="px-4 py-4 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${
                              p.estado === 'vigente' ? 'bg-amber-100 text-amber-700' :
                              p.estado === 'finalizado' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {p.estado}
                            </span>
                          </td>
                          
                          {/* Cuotas (Fijas en cajita) */}
                          <td className="px-4 py-4">
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
                                  <span className={`w-1.5 h-1.5 rounded-full ${cuota.estado === 'pagada' ? 'bg-emerald-500' : cuota.estado === 'anulada' ? 'bg-slate-300' : 'bg-amber-400'}`} />
                                  C{cuota.nro_cuota}
                                </button>
                              ))}
                            </div>
                          </td>
                          
                          {/* Acciones */}
                          <td className="px-4 py-4 text-right">
                            <div className="flex flex-col items-end gap-2">
                              {p.estado === 'vigente' && (
                                <button 
                                  onClick={() => handleCancelarPrestamo(p.id)} 
                                  className="text-[10px] font-bold text-red-500 hover:text-red-600 px-2 py-1"
                                >
                                  Cancelar Préstamo
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

      {/* MODAL REPORTE EXCEL */}
      {showModalReporte && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[95vw] lg:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-800">Exportar Cobros (Agrupados por Socio)</h2>
              <button onClick={() => setShowModalReporte(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500">✕</button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex gap-4 items-end mb-6">
                <div className="flex-1 max-w-xs">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Seleccionar Período a Exportar</label>
                  <select 
                    value={periodoSeleccionado} 
                    onChange={(e) => setPeriodoSeleccionado(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="" disabled>Seleccione un mes...</option>
                    {periodos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={cargarReporte}
                    disabled={!periodoSeleccionado || cargandoReporte}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                  >
                    {cargandoReporte ? 'Buscando...' : 'Previsualizar Datos'}
                  </button>
                </div>
              </div>

              {reporteData.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase">Legajo</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase">Socio</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase text-right">Total a Descontar</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-xs uppercase">Detalle Cuotas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reporteData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-mono text-xs">{row.legajo}</td>
                          <td className="px-4 py-2 font-bold text-slate-800">{row.nombre_completo}</td>
                          <td className="px-4 py-2 font-black text-emerald-700 text-right">{formatMoney(row.total_a_descontar)}</td>
                          <td className="px-4 py-2 text-xs text-slate-500 max-w-xs truncate" title={row.detalle}>{row.detalle}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <p className="text-sm text-slate-500 font-medium">
                Socios encontrados: {reporteData.length}
              </p>
              <button 
                onClick={descargarExcel}
                disabled={reporteData.length === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-md shadow-emerald-500/20"
              >
                <span>⬇️</span> Exportar a Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COBRO MASIVO */}
      {showModalCobro && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-800">Cobrar Cuotas del Mes</h2>
              <button onClick={() => setShowModalCobro(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500">✕</button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-6">
                Al aceptar, todas las cuotas de préstamos que correspondan al período seleccionado y se encuentren en estado <strong>Pendiente</strong>, pasarán automáticamente a estado <strong>Pagada</strong>.
              </p>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Seleccionar Período</label>
              <select 
                value={periodoCobro} 
                onChange={(e) => setPeriodoCobro(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 mb-6"
              >
                <option value="" disabled>Seleccione un mes...</option>
                {periodos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>

              <button 
                onClick={handleCobroMasivo}
                disabled={!periodoCobro || cobrandoMasivo}
                className="w-full px-6 py-3.5 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-md shadow-violet-500/20"
              >
                {cobrandoMasivo ? 'Procesando...' : 'Confirmar Cobro Masivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
