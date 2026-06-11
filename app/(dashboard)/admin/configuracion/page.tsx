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
            {/* Monto deposito default */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="block text-sm font-bold text-slate-800 mb-1">Monto de depósito por defecto</label>
              <p className="text-xs text-slate-500 mb-3">Monto sugerido al realizar una acreditación masiva.</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input 
                  type="number" 
                  value={getVal('monto_deposito_default')} 
                  onChange={(e) => handleChange('monto_deposito_default', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                />
              </div>
            </div>
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
