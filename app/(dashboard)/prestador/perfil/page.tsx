'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse } from '@/lib/types';

export default function PrestadorPerfil() {
  const { user } = useAuth();

  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user?.prestador) {
      setDireccion((user.prestador as any).direccion || '');
      setTelefono((user.prestador as any).telefono || '');
    }
  }, [user]);

  const handleGuardar = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      return setMsg({ type: 'err', text: 'Las contraseñas nuevas no coinciden.' });
    }
    setSaving(true);
    setMsg(null);
    try {
      const body: any = { direccion, telefono };
      if (newPassword) {
        body.current_password = currentPassword;
        body.password = newPassword;
        body.password_confirmation = confirmPassword;
      }
      await api.put('/prestador/perfil', body);
      setMsg({ type: 'ok', text: '✅ Perfil actualizado correctamente.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message || 'Error al guardar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Mi Perfil" subtitle="Configuración del local" />
      <div className="p-4 md:p-6 max-w-xl mx-auto space-y-6">

        {/* Info del local */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">Datos del local</h2>
            <p className="text-xs text-slate-400 mt-0.5">El nombre de usuario no se puede cambiar.</p>
          </div>
          <div className="p-5 space-y-4">
            {/* Usuario (solo lectura) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Usuario de acceso</label>
              <div className="px-3 py-2 rounded-xl bg-slate-100 text-sm text-slate-500 font-mono">
                {user?.username || user?.name || '—'}
              </div>
            </div>

            {/* Nombre del local (solo lectura) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nombre del local</label>
              <div className="px-3 py-2 rounded-xl bg-slate-100 text-sm text-slate-600 font-semibold">
                {user?.name || '—'}
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Dirección</label>
              <input
                type="text"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Ej: Av. San Martín 1250"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Teléfono de contacto</label>
              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="Ej: 3863 400000"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">Cambiar contraseña</h2>
            <p className="text-xs text-slate-400 mt-0.5">Dejá en blanco si no querés cambiarla.</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Contraseña actual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Tu contraseña actual"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repetí la nueva contraseña"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Feedback */}
        {msg && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {msg.text}
          </div>
        )}

        <button
          onClick={handleGuardar}
          disabled={saving}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </>
  );
}
