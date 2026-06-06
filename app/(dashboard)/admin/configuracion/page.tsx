'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, Setting } from '@/lib/types';

export default function AdminConfiguracion() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.get<ApiResponse<Setting[]>>('/admin/settings')
      .then((res) => setSettings(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/admin/settings', { settings });
      setMessage({ type: 'success', text: 'Configuración guardada correctamente.' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const getVal = (key: string) => settings.find((s) => s.key === key)?.value || '';

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <>
      <TopBar title="Configuración" subtitle="Sistema" />
      <div className="p-4 md:p-6 max-w-2xl">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-6">Reglas de negocio</h2>

          {message && (
            <div className={`rounded-xl px-4 py-3 mb-6 text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-6">
            {/* Saldo acumulable */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-800">Saldo acumulable</p>
                <p className="text-xs text-slate-500 mt-1">Si está activo, el saldo no gastado en un mes se suma al siguiente.</p>
              </div>
              <button 
                onClick={() => handleChange('saldo_acumulable', getVal('saldo_acumulable') === 'true' ? 'false' : 'true')}
                className={`w-12 h-7 rounded-full transition-all duration-300 relative shrink-0 ${getVal('saldo_acumulable') === 'true' ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${getVal('saldo_acumulable') === 'true' ? 'translate-x-6 left-0' : 'translate-x-1 left-0'}`} />
              </button>
            </div>

            {/* Permite negativo */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-800">Permitir saldo negativo</p>
                <p className="text-xs text-slate-500 mt-1">Si está activo, los socios pueden comprar por encima de su saldo hasta el tope definido.</p>
              </div>
              <button 
                onClick={() => handleChange('permite_negativo', getVal('permite_negativo') === 'true' ? 'false' : 'true')}
                className={`w-12 h-7 rounded-full transition-all duration-300 relative shrink-0 ${getVal('permite_negativo') === 'true' ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${getVal('permite_negativo') === 'true' ? 'translate-x-6 left-0' : 'translate-x-1 left-0'}`} />
              </button>
            </div>

            {/* Tope negativo */}
            {getVal('permite_negativo') === 'true' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-bold text-slate-800 mb-1">Tope negativo por defecto</label>
                <p className="text-xs text-slate-500 mb-3">Monto máximo que se permite adeudar.</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    type="number" 
                    value={getVal('tope_negativo_default')} 
                    onChange={(e) => handleChange('tope_negativo_default', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition-all w-full sm:w-auto"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
