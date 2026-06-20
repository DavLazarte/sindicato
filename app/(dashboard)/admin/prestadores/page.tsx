'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Prestador } from '@/lib/types';

export default function AdminPrestadores() {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrestador, setEditingPrestador] = useState<Prestador | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ nombre: '', username: '', direccion: '', telefono: '', password: '' });

  const fetchData = useCallback((p: number) => {
    setLoading(true);
    api.get<ApiResponse<PaginatedData<Prestador>>>(`/admin/prestadores?page=${p}${search ? `&search=${search}` : ''}`)
      .then((res) => { setPrestadores(res.data.data); setPage(res.data.current_page); setLastPage(res.data.last_page); })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { 
    const timer = setTimeout(() => {
      fetchData(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchData]);

  const openCreate = () => {
    setEditingPrestador(null);
    setForm({ nombre: '', username: '', direccion: '', telefono: '', password: '' });
    setShowModal(true);
  };

  const openEdit = (p: Prestador) => {
    setEditingPrestador(p);
    setForm({ nombre: p.nombre, username: p.user?.username || '', direccion: p.direccion || '', telefono: p.telefono || '', password: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingPrestador) {
        await api.put(`/admin/prestadores/${editingPrestador.id}`, {
          nombre: form.nombre, username: form.username, direccion: form.direccion, telefono: form.telefono
        });
      } else {
        await api.post('/admin/prestadores', form);
      }
      setShowModal(false);
      fetchData(page);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este negocio?')) return;
    await api.delete(`/admin/prestadores/${id}`);
    fetchData(page);
  };

  const handleResetPassword = async (id: number) => {
    if (!confirm('¿Seguro que querés restaurar la contraseña de este negocio a su Usuario/CUIT original?')) return;
    try {
      const res = await api.post(`/admin/prestadores/${id}/reset-password`);
      alert(res.data?.message || 'Contraseña restaurada.');
    } catch (err: any) {
      alert(err?.message || 'Error al restaurar contraseña.');
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  return (
    <>
      <TopBar title="Negocios" subtitle="Gestión" action={
        <button onClick={openCreate} className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors">+ Nuevo</button>
      } />
      <div className="p-4 md:p-6 space-y-4">
        {/* Search */}
        <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Buscar por nombre..." className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all" />

        {/* Table / Cards */}
        {loading ? (
          <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Dirección</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase">Estado</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase">Acciones</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {prestadores.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">{p.nombre}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{p.user?.username}</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{p.direccion || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.estado === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{p.estado}</span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => openEdit(p)} className="text-xs font-bold text-blue-600 hover:text-blue-700">Editar</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs font-bold text-red-500 hover:text-red-600">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {prestadores.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{p.nombre}</p>
                      <p className="text-xs text-slate-500 font-mono">@{p.user?.username}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.estado === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{p.estado}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{p.direccion || 'Sin dirección'}</p>
                  <div className="flex justify-end space-x-3">
                    <button onClick={() => openEdit(p)} className="text-xs font-bold text-blue-600">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs font-bold text-red-500">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>

            {lastPage > 1 && (
              <div className="flex justify-center gap-2 pt-2">
                <button disabled={page <= 1} onClick={() => fetchData(page - 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors">Anterior</button>
                <span className="px-4 py-2 text-sm text-slate-500">{page} / {lastPage}</span>
                <button disabled={page >= lastPage} onClick={() => fetchData(page + 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-colors">Siguiente</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-5">{editingPrestador ? 'Editar negocio' : 'Nuevo negocio'}</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                <input type="text" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-purple-500 transition-all" /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario (Login)</label>
                <input type="text" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-purple-500 transition-all font-mono" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección</label>
                  <input type="text" autoComplete="off" value={form.direccion} onChange={(e) => setForm({...form, direccion: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-purple-500 transition-all" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                  <input type="text" autoComplete="off" value={form.telefono} onChange={(e) => setForm({...form, telefono: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-purple-500 transition-all" /></div>
              </div>
              {!editingPrestador ? (
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña inicial</label>
                  <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-purple-500 transition-all" /></div>
              ) : (
                <div className="flex flex-col items-start bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2">
                  <span className="block text-xs font-bold text-slate-500 uppercase mb-2">Seguridad</span>
                  <button type="button" onClick={() => editingPrestador && handleResetPassword(editingPrestador.id)} className="text-xs font-bold px-3 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors">
                    🔑 Restaurar Contraseña al Usuario
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-40 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
