'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, Cuota } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }

interface SocioBuscado {
  id: number;
  nombre_completo: string;
  legajo: string;
  saldo_disponible: number;
  estado: string;
  cuotas_pendientes?: Cuota[];
}

export default function PrestadorCobrar() {
  const [legajo, setLegajo] = useState('');
  const [socio, setSocio] = useState<SocioBuscado | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');

  const [monto, setMonto] = useState('');
  const [esCuotas, setEsCuotas] = useState(false);
  const [cantCuotas, setCantCuotas] = useState(3);
  const [cobrando, setCobrando] = useState(false);

  const [resultado, setResultado] = useState<'success' | 'error' | null>(null);
  const [mensajeResultado, setMensajeResultado] = useState('');

  const [cobrandoCuota, setCobrandoCuota] = useState<number | null>(null);

  const cobrarCuotaManual = async (cuotaId: number) => {
    if (!confirm('¿Estás seguro de cobrar esta cuota ahora? Se descontará del saldo del socio.')) return;
    setCobrandoCuota(cuotaId);
    setResultado(null);
    try {
      await api.post(`/prestador/cuotas/${cuotaId}/cobrar`);
      setResultado('success');
      setMensajeResultado('Cuota cobrada correctamente');
      // Refrescar los datos del socio para ver saldo nuevo y cuotas actualizadas
      if (legajo.trim()) {
        const res = await api.get<ApiResponse<SocioBuscado>>(`/prestador/socios/buscar?legajo=${legajo.trim()}`);
        setSocio(res.data);
      }
    } catch (err: unknown) {
      setResultado('error');
      setMensajeResultado(err instanceof Error ? err.message : 'Error al cobrar cuota');
    } finally {
      setCobrandoCuota(null);
    }
  };

  const buscarSocio = async () => {
    if (!legajo.trim()) return;
    setErrorBusqueda('');
    setSocio(null);
    setBuscando(true);
    try {
      const res = await api.get<ApiResponse<SocioBuscado>>(`/prestador/socios/buscar?legajo=${legajo.trim()}`);
      setSocio(res.data);
    } catch (err: unknown) {
      setErrorBusqueda(err instanceof Error ? err.message : 'Socio no encontrado');
    } finally {
      setBuscando(false);
    }
  };

  const confirmarCobro = async () => {
    if (!socio || !monto) return;
    const m = parseFloat(monto);
    if (m <= 0) return;

    setCobrando(true);
    setResultado(null);
    try {
      await api.post('/prestador/transacciones', {
        socio_id: socio.id,
        monto_total: m,
        es_cuotas: esCuotas,
        cantidad_cuotas: esCuotas ? cantCuotas : undefined,
      });
      setResultado('success');
      setMensajeResultado(`Cobro de ${formatMoney(m)} a ${socio.nombre_completo} registrado`);
      // Reset form
      setMonto('');
      setEsCuotas(false);
      setSocio(null);
      setLegajo('');
    } catch (err: unknown) {
      setResultado('error');
      setMensajeResultado(err instanceof Error ? err.message : 'Error al registrar');
    } finally {
      setCobrando(false);
    }
  };

  const limpiar = () => {
    setSocio(null);
    setLegajo('');
    setMonto('');
    setEsCuotas(false);
    setResultado(null);
  };

  return (
    <>
      <TopBar title="Registrar cobro" subtitle="Cobrar a socio" />
      <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">

        {/* Success/Error Banner */}
        {resultado && (
          <div className={`rounded-2xl p-5 flex items-start gap-3 ${resultado === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
            <span className="text-2xl">{resultado === 'success' ? '✅' : '❌'}</span>
            <div>
              <p className={`text-sm font-bold ${resultado === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>{mensajeResultado}</p>
              <button onClick={limpiar} className="text-xs font-semibold text-slate-500 hover:text-slate-700 mt-2 underline">
                {resultado === 'success' ? 'Nuevo cobro' : 'Intentar de nuevo'}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Search */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">1</span>
            Buscar socio
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={legajo}
              onChange={(e) => setLegajo(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && buscarSocio()}
              placeholder="Ingresá el legajo (ej: S001)"
              className="flex-1 px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono text-lg tracking-wider"
            />
            <button onClick={buscarSocio} disabled={buscando || !legajo.trim()} className="px-5 py-3.5 rounded-xl bg-slate-900 text-white text-sm font-bold shrink-0 hover:bg-slate-800 disabled:opacity-40 transition-all">
              {buscando ? '...' : '🔍'}
            </button>
          </div>
          {errorBusqueda && <p className="text-red-500 text-sm mt-3 font-medium">⚠️ {errorBusqueda}</p>}
        </div>

        {/* Socio Found Card */}
        {socio && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-200 p-6 shadow-sm animate-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-2xl font-bold">
                {socio.nombre_completo.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-slate-800">{socio.nombre_completo}</p>
                <p className="text-sm text-slate-500 font-medium">Legajo: {socio.legajo}</p>
              </div>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Saldo disponible</p>
              <p className={`text-3xl font-black ${socio.saldo_disponible > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatMoney(socio.saldo_disponible)}
              </p>
            </div>
          </div>
        )}

        {/* Pending Cuotas Warning */}
        {socio && socio.cuotas_pendientes && socio.cuotas_pendientes.length > 0 && (
          <div className="bg-amber-50 rounded-3xl border border-amber-200 p-6 shadow-sm animate-in">
            <h2 className="text-base font-bold text-amber-800 mb-4 flex items-center gap-2">
              <span>⚠️</span> El socio tiene cuotas pendientes
            </h2>
            <div className="space-y-3">
              {socio.cuotas_pendientes.map((cuota) => (
                <div key={cuota.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-2xl border border-amber-100 gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Vence en: <span className="capitalize">{cuota.periodo?.nombre}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Monto: <strong className="text-amber-600">{formatMoney(cuota.monto)}</strong> (Cuota {cuota.nro_cuota})
                    </p>
                  </div>
                  <button
                    onClick={() => cobrarCuotaManual(cuota.id)}
                    disabled={cobrandoCuota === cuota.id || socio.saldo_disponible < cuota.monto}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {cobrandoCuota === cuota.id ? '...' : 'Cobrar cuota'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Amount */}
        {socio && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">2</span>
              Monto a cobrar
            </h2>

            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-slate-400 font-bold">$</span>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-4 py-5 rounded-xl border border-slate-200 bg-slate-50 text-3xl font-black text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            {/* Cuotas toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-4">
              <span className="text-sm font-semibold text-slate-700">¿Pago en cuotas?</span>
              <button
                onClick={() => setEsCuotas(!esCuotas)}
                className={`w-12 h-7 rounded-full transition-all duration-300 ${esCuotas ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${esCuotas ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {esCuotas && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cantidad de cuotas</label>
                <div className="flex gap-2 flex-wrap">
                  {[2, 3, 4, 6, 9, 12].map((n) => (
                    <button key={n} onClick={() => setCantCuotas(n)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${cantCuotas === n ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {n}x
                    </button>
                  ))}
                </div>
                {monto && parseFloat(monto) > 0 && (
                  <p className="text-sm text-slate-500 mt-3 font-medium">
                    {cantCuotas} cuotas de <span className="font-bold text-slate-800">{formatMoney(parseFloat(monto) / cantCuotas)}</span>
                  </p>
                )}
              </div>
            )}

            {/* Summary */}
            {monto && parseFloat(monto) > 0 && (
              <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-100">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Socio</span>
                  <span className="font-semibold text-slate-800">{socio.nombre_completo}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Monto total</span>
                  <span className="font-bold text-slate-800">{formatMoney(parseFloat(monto))}</span>
                </div>
                {esCuotas && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Modalidad</span>
                    <span className="font-semibold text-blue-600">{cantCuotas} cuotas</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={confirmarCobro}
              disabled={cobrando || !monto || parseFloat(monto) <= 0}
              className="w-full px-6 py-4 rounded-xl bg-emerald-500 text-white font-bold text-base hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
            >
              {cobrando ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando...</>
              ) : (
                <><span>✅</span> Confirmar cobro</>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
