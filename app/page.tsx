"use client";
import { useState, useCallback } from "react";

// ─── DATOS DE DEMO ──────────────────────────────────────────────
const MENSUAL = 15000;

const NEGOCIOS_META: Record<string, any> = {
  carniceria: { nombre: "Carnicería Don José", icon: "🥩", color: "#ef4444", bg: "#fef2f2" },
  farmacia:   { nombre: "Farmacia Central",    icon: "💊", color: "#3b82f6", bg: "#eff6ff" },
  panaderia:  { nombre: "Panadería El Trigo",  icon: "🍞", color: "#f59e0b", bg: "#fffbeb" },
  verduleria: { nombre: "Verdulería La Huerta",icon: "🥦", color: "#10b981", bg: "#f0fdf4" },
  ferreteria: { nombre: "Ferretería Tornillo", icon: "🔧", color: "#6366f1", bg: "#eef2ff" },
  kiosco:     { nombre: "Kiosco La Esquina",   icon: "🛍️", color: "#ec4899", bg: "#fdf2f8" },
};

const SOCIOS_INICIAL = [
  { id: "S001", nombre: "Juan Pérez",       avatar: "JP", saldos: { carniceria: 5000, farmacia: 4000, panaderia: 2000, verduleria: 2000, ferreteria: 1500, kiosco: 500  } },
  { id: "S002", nombre: "María García",     avatar: "MG", saldos: { carniceria: 3000, farmacia: 6000, panaderia: 1000, verduleria: 2500, ferreteria: 1000, kiosco: 1500 } },
  { id: "S003", nombre: "Carlos López",     avatar: "CL", saldos: { carniceria: 7000, farmacia: 2000, panaderia: 3000, verduleria: 1000, ferreteria: 1000, kiosco: 1000 } },
  { id: "S004", nombre: "Ana Martínez",     avatar: "AM", saldos: { carniceria: 2000, farmacia: 5000, panaderia: 4000, verduleria: 2000, ferreteria: 1000, kiosco: 1000 } },
  { id: "S005", nombre: "Luis Rodríguez",   avatar: "LR", saldos: { carniceria: 4000, farmacia: 3000, panaderia: 2000, verduleria: 3000, ferreteria: 2000, kiosco: 1000 } },
];

// ─── HELPERS ────────────────────────────────────────────────────
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const totalSocio = (s: any): number => Object.values(s.saldos).reduce((a: any, b: any) => a + b, 0);
const now = () => { const d = new Date(); return d.getHours().toString().padStart(2,"0")+":"+d.getMinutes().toString().padStart(2,"0"); };

// ─── COMPONENTES PEQUEÑOS ───────────────────────────────────────
function Avatar({ initials, size = 32 }: { initials: string, size?: number }) {
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.35 }} className="rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-semibold shrink-0">
      {initials}
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 right-6 bg-slate-900 text-white py-2.5 px-4 rounded-xl text-sm z-[1000] flex items-center gap-2 shadow-xl">
      <span className="text-emerald-500">✓</span> {msg}
    </div>
  );
}

function MetricCard({ label, value, accentClass }: { label: string, value: string | number, accentClass?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accentClass || "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number, color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mt-2">
      <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ background: color, width: `${pct}%` }} />
    </div>
  );
}

// ─── MODAL TRANSFERENCIA ─────────────────────────────────────────
function ModalTransfer({ socio, onClose, onConfirm }: { socio: any, onClose: () => void, onConfirm: (src: string, dst: string, m: number) => void }) {
  const keys = Object.keys(socio.saldos);
  const [src, setSrc] = useState(keys[0]);
  const [dst, setDst] = useState(keys[1]);
  const [monto, setMonto] = useState("");

  const handleConfirm = () => {
    const m = parseFloat(monto);
    if (!m || m <= 0) return alert("Ingresá un monto válido");
    if (src === dst) return alert("Origen y destino deben ser distintos");
    if (m > socio.saldos[src]) return alert("Saldo insuficiente");
    onConfirm(src, dst, m);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><span>⇄</span> Transferir saldo</h3>

        <label className="text-xs font-medium text-slate-500 block mb-1.5">Desde (origen)</label>
        <select value={src} onChange={e => setSrc(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-slate-900 text-sm outline-none cursor-pointer">
          {keys.map(k => <option key={k} value={k}>{NEGOCIOS_META[k].icon} {NEGOCIOS_META[k].nombre}</option>)}
        </select>
        <div className="text-xs font-medium text-slate-400 mb-5 mt-2">Disponible: <span className="text-emerald-600">{fmt(socio.saldos[src])}</span></div>

        <label className="text-xs font-medium text-slate-500 block mb-1.5">Hacia (destino)</label>
        <select value={dst} onChange={e => setDst(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-slate-900 text-sm outline-none mb-5 cursor-pointer">
          {keys.map(k => <option key={k} value={k}>{NEGOCIOS_META[k].icon} {NEGOCIOS_META[k].nombre}</option>)}
        </select>

        <label className="text-xs font-medium text-slate-500 block mb-1.5">Monto a transferir</label>
        <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 2000" className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all mb-8" />

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30 transition-all">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL COMPRA ────────────────────────────────────────────────
function ModalCompra({ socio, negocioKey, onClose, onConfirm }: { socio: any, negocioKey: string, onClose: () => void, onConfirm: (m: number) => void }) {
  const [monto, setMonto] = useState("");
  const n = NEGOCIOS_META[negocioKey];
  const handleConfirm = () => {
    const m = parseFloat(monto);
    if (!m || m <= 0) return alert("Ingresá un monto válido");
    if (m > socio.saldos[negocioKey]) return alert("Supera el saldo disponible");
    onConfirm(m);
  };
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-semibold mb-5 flex items-center gap-2"><span>{n.icon}</span> Registrar compra</h3>
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Avatar initials={socio.avatar} />
          <div>
            <div className="font-semibold text-sm">{socio.nombre}</div>
            <div className="text-xs text-slate-500 mt-0.5">Saldo: <span className="font-medium text-slate-700">{fmt(socio.saldos[negocioKey])}</span></div>
          </div>
        </div>
        <label className="text-xs font-medium text-slate-500 block mb-1.5">Monto de la compra</label>
        <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 3500" className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all mb-8" />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30 transition-all">Cobrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── VISTA SOCIO ────────────────────────────────────────────────
function VistaSocio({ socios, socioIdx, setSocioIdx, onTransfer, actividades }: { socios: any[], socioIdx: number, setSocioIdx: (i: number) => void, onTransfer: () => void, actividades: any[] }) {
  const s = socios[socioIdx];
  const total = totalSocio(s);
  const keys = Object.keys(s.saldos);
  const miAct = actividades.filter(a => a.desc.includes(s.nombre)).slice(-4).reverse();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white border-b border-slate-200 p-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="text-xs font-medium text-slate-400 mb-0.5 uppercase tracking-wider">Vista actual</div>
          <h2 className="text-xl font-bold text-slate-800">Panel del Socio</h2>
        </div>
        <select value={socioIdx} onChange={e => setSocioIdx(+e.target.value)} className="w-full md:w-64 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 outline-none cursor-pointer">
          {socios.map((s, i) => <option key={s.id} value={i}>{s.nombre} ({s.id})</option>)}
        </select>
      </div>
      
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <MetricCard label="Saldo total disponible" value={fmt(total)} accentClass="text-emerald-500" />
          <MetricCard label="Crédito mensual" value={fmt(MENSUAL)} />
          <MetricCard label="Negocios activos" value={`${keys.filter(k => s.saldos[k] > 0).length} de ${keys.length}`} />
        </div>

        <div className="flex flex-col xl:flex-row gap-6 items-start">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-7 w-full xl:flex-1 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div className="text-base font-semibold text-slate-800">Saldo distribuido</div>
              <button onClick={onTransfer} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium flex justify-center items-center gap-2 hover:bg-slate-800 transition-colors">
                <span>⇄</span> Transferir
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {keys.map(k => (
                <div key={k} className="group">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-600 flex items-center gap-2"><span className="text-lg bg-slate-50 p-1.5 rounded-lg group-hover:scale-110 transition-transform">{NEGOCIOS_META[k].icon}</span> {NEGOCIOS_META[k].nombre}</span>
                    <span className="text-sm font-bold text-slate-800">{fmt(s.saldos[k])}</span>
                  </div>
                  <ProgressBar pct={total > 0 ? Math.round((s.saldos[k] / total) * 100) : 0} color={NEGOCIOS_META[k].color} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 w-full xl:w-80 shrink-0 shadow-sm">
            <div className="text-sm font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <span className="text-lg">⚡</span> Actividad reciente
            </div>
            {miAct.length === 0 && <div className="text-sm text-slate-400 italic">Sin actividad aún.</div>}
            <div className="space-y-4">
              {miAct.map((a, i) => (
                <div key={i} className="flex gap-3 relative">
                  {i !== miAct.length - 1 && <div className="absolute left-1.5 top-5 bottom-[-16px] w-[2px] bg-slate-100" />}
                  <div className={`w-3 h-3 rounded-full mt-1 shrink-0 z-10 border-[3px] border-white ${a.dot === 'orange' ? 'bg-amber-500' : a.dot === 'blue' ? 'bg-blue-500' : 'bg-emerald-500 shadow-[0_0_0_2px_#10b98120]'}`} />
                  <div className="pb-1">
                    <div className="text-[13px] text-slate-700 font-medium leading-snug">{a.desc}</div>
                    <div className="text-[11px] font-semibold text-slate-400 mt-1">{a.hora}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VISTA NEGOCIO ───────────────────────────────────────────────
function VistaNegocio({ socios, negocioKey, setNegocioKey, onCompra }: { socios: any[], negocioKey: string, setNegocioKey: (k: string) => void, onCompra: (idx: number) => void }) {
  const n = NEGOCIOS_META[negocioKey];
  const totalSaldo = socios.reduce((a, s) => a + s.saldos[negocioKey], 0);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white border-b border-slate-200 p-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="text-xs font-medium text-slate-400 mb-0.5 uppercase tracking-wider">Vista actual</div>
          <h2 className="text-xl font-bold text-slate-800">Panel del Negocio</h2>
        </div>
        <select value={negocioKey} onChange={e => setNegocioKey(e.target.value)} className="w-full md:w-64 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 outline-none cursor-pointer">
          {Object.keys(NEGOCIOS_META).map(k => <option key={k} value={k}>{NEGOCIOS_META[k].icon} {NEGOCIOS_META[k].nombre}</option>)}
        </select>
      </div>
      
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="rounded-3xl p-5 md:p-8 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 border shadow-sm transition-colors duration-500" style={{ background: n.bg, borderColor: `${n.color}30` }}>
          <div className="flex items-center gap-4 md:gap-5">
            <span className="text-5xl md:text-6xl drop-shadow-sm">{n.icon}</span>
            <div>
              <div className="text-xl md:text-2xl font-bold text-slate-800">{n.nombre}</div>
              <div className="text-sm font-medium text-slate-600/80 mt-1">Negocio adherido al gremio</div>
            </div>
          </div>
          <div className="sm:text-right bg-white/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/40">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total a favor</div>
            <div className="text-3xl font-extrabold" style={{ color: n.color }}>{fmt(totalSaldo)}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="text-base font-semibold text-slate-800">Clientes del gremio</div>
            <div className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{socios.length} usuarios</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/50">
                  {["Socio", "Saldo disponible", "Estado", "Acción"].map(h => (
                    <th key={h} className="text-left py-3 px-5 md:px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {socios.map((s, i) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group">
                    <td className="py-3.5 px-5 md:px-6">
                      <div className="flex items-center gap-3">
                        <Avatar initials={s.avatar} />
                        <div>
                          <div className="font-semibold text-slate-800">{s.nombre}</div>
                          <div className="text-[11px] font-medium text-slate-400 mt-0.5">{s.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`py-3.5 px-5 md:px-6 font-bold text-base ${s.saldos[negocioKey] > 0 ? "text-emerald-500" : "text-slate-400"}`}>
                      {fmt(s.saldos[negocioKey])}
                    </td>
                    <td className="py-3.5 px-5 md:px-6">
                      <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5 ${s.saldos[negocioKey] > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                        {s.saldos[negocioKey] > 0 ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Con saldo</> : <><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Sin saldo</>}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 md:px-6">
                      <button disabled={s.saldos[negocioKey] <= 0} onClick={() => onCompra(i)} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${s.saldos[negocioKey] <= 0 ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5'}`}>
                        <span>🛒</span> Cobrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VISTA ADMIN ─────────────────────────────────────────────────
function VistaAdmin({ socios, actividades, onAcreditar }: { socios: any[], actividades: any[], onAcreditar: () => void }) {
  const keys = Object.keys(NEGOCIOS_META);
  const granTotal = socios.reduce((a, s) => a + totalSocio(s), 0);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white border-b border-slate-200 p-4 md:px-6 md:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="text-xs font-medium text-slate-400 mb-0.5 uppercase tracking-wider">Vista actual</div>
          <h2 className="text-xl font-bold text-slate-800">Panel Administrador</h2>
        </div>
        <button onClick={onAcreditar} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex justify-center items-center gap-2 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 transition-all">
          <span>💰</span> Acreditar mensualidad
        </button>
      </div>
      
      <div className="p-4 md:p-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <MetricCard label="Total socios" value={socios.length} accentClass="text-indigo-600" />
          <MetricCard label="Negocios adheridos" value={keys.length} />
          <MetricCard label="Saldo total en circulación" value={fmt(granTotal)} accentClass="text-emerald-500" />
        </div>

        <div className="flex flex-col xl:flex-row gap-6 items-start">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden w-full xl:flex-1 shadow-sm">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="text-base font-semibold text-slate-800">Saldos globales</div>
            </div>
            <div className="overflow-x-auto pb-1">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50/90 backdrop-blur shadow-[1px_0_0_#f1f5f9] z-10">Socio</th>
                    {keys.map(k => (
                      <th key={k} className="text-center py-3 px-3">
                        <div className="flex flex-col items-center gap-1 group">
                          <span className="text-xl bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">{NEGOCIOS_META[k].icon}</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{NEGOCIOS_META[k].nombre.split(" ")[0]}</span>
                        </div>
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {socios.map(s => (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 sticky left-0 bg-white shadow-[1px_0_0_#f8fafc] z-10">
                        <div className="flex items-center gap-2.5 whitespace-nowrap">
                          <Avatar initials={s.avatar} size={28} />
                          <span className="font-semibold text-slate-700">{s.nombre}</span>
                        </div>
                      </td>
                      {keys.map(k => <td key={k} className="text-center py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap">{fmt(s.saldos[k])}</td>)}
                      <td className="text-right py-2.5 px-4 font-bold text-emerald-600 whitespace-nowrap bg-emerald-50/30">{fmt(totalSocio(s))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t border-slate-200">
                    <td className="py-4 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-100 shadow-[1px_0_0_#e2e8f0] z-10">Total x Negocio</td>
                    {keys.map(k => <td key={k} className="text-center py-4 px-3 font-bold text-slate-700 text-sm">{fmt(socios.reduce((a, s) => a + s.saldos[k], 0))}</td>)}
                    <td className="text-right py-4 px-4 font-black text-emerald-600 text-base">{fmt(granTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 w-full xl:w-80 shrink-0 shadow-sm">
            <div className="text-sm font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <span className="text-lg">📜</span> Log de movimientos
            </div>
            <div className="space-y-4">
              {[...actividades].reverse().slice(0, 8).map((a, i) => (
                <div key={i} className="flex gap-3 relative">
                  {i !== Math.min(actividades.length, 8) - 1 && <div className="absolute left-1.5 top-5 bottom-[-16px] w-[2px] bg-slate-100" />}
                  <div className={`w-3 h-3 rounded-full mt-1 shrink-0 z-10 border-[3px] border-white ${a.dot === 'orange' ? 'bg-amber-500' : a.dot === 'blue' ? 'bg-blue-500' : 'bg-emerald-500 shadow-[0_0_0_2px_#10b98120]'}`} />
                  <div className="pb-1">
                    <div className="text-[13px] text-slate-700 font-medium leading-snug">{a.desc}</div>
                    <div className="text-[11px] font-semibold text-slate-400 mt-1">{a.hora}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NAV ITEMS ───────────────────────────────────────────────────
const NAV = [
  { id: "socio",   label: "Socio",          icon: "👤" },
  { id: "negocio", label: "Negocio",         icon: "🏪" },
  { id: "admin",   label: "Administrador",   icon: "⚙️" },
];

// ─── APP PRINCIPAL ───────────────────────────────────────────────
export default function GremioApp() {
  const [view, setView] = useState("socio");
  const [socios, setSocios] = useState(() => JSON.parse(JSON.stringify(SOCIOS_INICIAL)));
  const [socioIdx, setSocioIdx] = useState(0);
  const [negocioKey, setNegocioKey] = useState("carniceria");
  const [actividades, setActividades] = useState([
    { tipo: "acreditacion", desc: "Acreditación mensual inicial — todos los socios", hora: "09:00", dot: "blue" },
    { tipo: "transferencia", desc: "Juan Pérez movió $2.000 de Kiosco → Carnicería", hora: "10:15", dot: "" },
    { tipo: "compra", desc: "Farmacia Central descontó $1.500 a María García", hora: "11:30", dot: "orange" },
  ]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [compraTarget, setCompraTarget] = useState<number | null>(null); // socioIdx
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }, []);

  const addActividad = useCallback((a: any) => setActividades((prev: any[]) => [...prev, a]), []);

  const handleTransfer = (src: string, dst: string, monto: number) => {
    setSocios((prev: any[]) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[socioIdx].saldos[src] -= monto;
      next[socioIdx].saldos[dst] += monto;
      return next;
    });
    addActividad({
      tipo: "transferencia",
      desc: `${socios[socioIdx].nombre} movió ${fmt(monto)} de ${NEGOCIOS_META[src].nombre.split(" ")[0]} → ${NEGOCIOS_META[dst].nombre.split(" ")[0]}`,
      hora: now(), dot: "",
    });
    setShowTransfer(false);
    showToast("Transferencia realizada con éxito");
  };

  const handleCompra = (monto: number) => {
    if (compraTarget === null) return;
    setSocios((prev: any[]) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[compraTarget].saldos[negocioKey] -= monto;
      return next;
    });
    addActividad({
      tipo: "compra",
      desc: `${NEGOCIOS_META[negocioKey].nombre} descontó ${fmt(monto)} a ${socios[compraTarget].nombre}`,
      hora: now(), dot: "orange",
    });
    setCompraTarget(null);
    showToast(`Compra registrada: ${fmt(monto)} descontado`);
  };

  const handleAcreditar = () => {
    setSocios((prev: any[]) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.forEach((s: any) => {
        const keys = Object.keys(s.saldos);
        const porNegocio = Math.floor(MENSUAL / keys.length);
        keys.forEach(k => s.saldos[k] += porNegocio);
      });
      return next;
    });
    addActividad({ tipo: "acreditacion", desc: `Acreditación mensual (${fmt(MENSUAL)}/socio) — ${socios.length} socios`, hora: now(), dot: "blue" });
    showToast("Mensualidad acreditada a todos los socios");
  };

  return (
    <div className="flex flex-col md:flex-row h-screen font-sans bg-slate-50 overflow-hidden text-slate-900">
      {/* SIDEBAR / TOPNAV EN MOBILE */}
      <div className="w-full md:w-[240px] bg-slate-900 flex flex-col shrink-0 z-20 shadow-xl">
        <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center md:block bg-slate-950/50">
          <div>
            <div className="text-white text-base md:text-lg font-bold flex items-center gap-2"><span>🛡️</span> GremioApp</div>
            <div className="text-emerald-400 font-medium text-[11px] md:text-xs mt-1 hidden md:block uppercase tracking-wider">Sistema de beneficios</div>
          </div>
        </div>
        
        <div className="flex overflow-x-auto md:flex-col md:overflow-visible flex-1 p-2 md:p-4 gap-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="hidden md:block px-3 pb-2 pt-4 text-slate-500 text-[11px] tracking-widest uppercase font-bold">Vistas</div>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)}
              className={`flex items-center gap-3 px-5 py-3 md:py-3.5 rounded-xl cursor-pointer text-sm font-semibold whitespace-nowrap transition-all duration-300 ${view === n.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 md:translate-x-2' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              <span className="text-xl md:text-2xl drop-shadow-sm">{n.icon}</span> 
              <span>{n.label}</span>
            </button>
          ))}
        </div>
        
        <div className="hidden md:block p-6 border-t border-white/10 mt-auto bg-slate-950/50">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Datos de demo</div>
          <div className="text-slate-500 text-[13px] font-medium mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {socios.length} socios activos
          </div>
          <div className="text-slate-500 text-[13px] font-medium mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            {Object.keys(NEGOCIOS_META).length} negocios adheridos
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden relative">
        {view === "socio" && (
          <VistaSocio
            socios={socios}
            socioIdx={socioIdx}
            setSocioIdx={setSocioIdx}
            onTransfer={() => setShowTransfer(true)}
            actividades={actividades}
          />
        )}
        {view === "negocio" && (
          <VistaNegocio
            socios={socios}
            negocioKey={negocioKey}
            setNegocioKey={setNegocioKey}
            onCompra={(idx: number) => setCompraTarget(idx)}
          />
        )}
        {view === "admin" && (
          <VistaAdmin socios={socios} actividades={actividades} onAcreditar={handleAcreditar} />
        )}
      </div>

      {/* MODALES */}
      {showTransfer && (
        <ModalTransfer socio={socios[socioIdx]} onClose={() => setShowTransfer(false)} onConfirm={handleTransfer} />
      )}
      {compraTarget !== null && (
        <ModalCompra socio={socios[compraTarget]} negocioKey={negocioKey} onClose={() => setCompraTarget(null)} onConfirm={handleCompra} />
      )}

      <Toast msg={toast} />
    </div>
  );
}
