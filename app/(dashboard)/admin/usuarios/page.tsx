'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, User } from '@/lib/types';

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'admin_socios' });
  const [passForm, setPassForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });

  const fetchUsuarios = () => {
    setLoading(true);
    api.get<ApiResponse<User[]>>('/admin/usuarios')
      .then(res => setUsuarios(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/usuarios', form);
      alert('Usuario creado.');
      setModalOpen(false);
      setForm({ name: '', username: '', password: '', role: 'admin_socios' });
      fetchUsuarios();
    } catch (err: any) {
      alert(err.message || 'Error al crear usuario');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar usuario?')) return;
    try {
      await api.delete(`/admin/usuarios/${id}`);
      fetchUsuarios();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passForm.new_password !== passForm.new_password_confirmation) {
      alert('Las contraseñas no coinciden.');
      return;
    }
    try {
      await api.put('/admin/password', passForm);
      alert('Contraseña actualizada correctamente.');
      setPasswordModalOpen(false);
      setPassForm({ current_password: '', new_password: '', new_password_confirmation: '' });
    } catch (err: any) {
      alert(err.message || 'Error al actualizar contraseña');
    }
  };

  return (
    <>
      <TopBar title="Usuarios" subtitle="Gestión de administradores" action={
        <div className="flex gap-2">
          <button onClick={() => setPasswordModalOpen(true)} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-300 transition-colors">
            🔑 Cambiar mi contraseña
          </button>
          <button onClick={() => setModalOpen(true)} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">
            + Nuevo Usuario
          </button>
        </div>
      } />
      
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">Cargando...</td></tr>
                ) : usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{u.name}</td>
                    <td className="p-4 text-slate-600 font-medium">@{u.username}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role === 'admin' ? 'Superadmin' : 'Admin Socios'}
                      </span>
                    </td>
                    <td className="p-4">
                      <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Nuevo Usuario Admin</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario (Login)</label>
                <input required type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
                <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rol</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500">
                  <option value="admin_socios">Admin Socios (Solo CRUD Socios)</option>
                  <option value="admin">Superadmin (Acceso Total)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Cambiar Mi Contraseña</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña Actual</label>
                <input required type="password" value={passForm.current_password} onChange={e => setPassForm({...passForm, current_password: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nueva Contraseña</label>
                <input required type="password" minLength={6} value={passForm.new_password} onChange={e => setPassForm({...passForm, new_password: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Repetir Nueva Contraseña</label>
                <input required type="password" minLength={6} value={passForm.new_password_confirmation} onChange={e => setPassForm({...passForm, new_password_confirmation: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setPasswordModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-900/20">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
