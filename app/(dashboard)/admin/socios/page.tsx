'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TopBar } from '@/components/layout/Navigation';
import type { ApiResponse, PaginatedData, Socio } from '@/lib/types';

function formatMoney(n: number) { return '$' + Math.round(n).toLocaleString('es-AR'); }

export default function AdminSocios() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSocio, setEditingSocio] = useState<Socio | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ nombre: '', apellido: '', legajo: '', celular: '', password: '', saldo_disponible: '0' });

  const fetchData = useCallback((p: number) => {
    setLoading(true);
    api.get<ApiResponse<PaginatedData<Socio>>>(`/admin/socios?page=${p}${search ? `&search=${search}` : ''}`)
      .then((res) => { setSocios(res.data.data); setPage(res.data.current_page); setLastPage(res.data.last_page); })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { 
    const timer = setTimeout(() => {
      fetchData(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchData]);

  const openCreate = () => {
    setEditingSocio(null);
    setForm({ nombre: '', apellido: '', legajo: '', celular: '', password: '', saldo_disponible: '0' });
    setShowModal(true);
  };

  const openEdit = (s: Socio) => {
    setEditingSocio(s);
    setForm({ nombre: s.nombre, apellido: s.apellido, legajo: s.legajo, celular: s.celular || '', password: '', saldo_disponible: String(s.saldo_disponible) });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingSocio) {
        const body: Record<string, unknown> = { nombre: form.nombre, apellido: form.apellido, legajo: form.legajo, celular: form.celular, saldo_disponible: parseFloat(form.saldo_disponible) || 0 };
        await api.put(`/admin/socios/${editingSocio.id}`, body);
      } else {
        await api.post('/admin/socios', { ...form, saldo_disponible: parseFloat(form.saldo_disponible) || 0 });
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
    if (!confirm('¿Eliminar este socio?')) return;
    await api.delete(`/admin/socios/${id}`);
    fetchData(page);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  return (
    <>
      <TopBar title="Socios" subtitle="Gestión" action={
        <button onClick={openCreate} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">+ Nuevo</button>
      } />
      <div className="p-4 md:p-6 space-y-4">
        {/* Search */}
        <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Buscar por nombre o legajo..." className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />

        {/* Table / Cards */}
        {loading ? (
          <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Legajo</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase">Nombre</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase">Saldo</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase">Estado</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase">Acciones</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {socios.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">{s.legajo}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{s.nombre} {s.apellido}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(s.saldo_disponible)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.estado === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{s.estado}</span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => openEdit(s)} className="text-xs font-bold text-blue-600 hover:text-blue-700">Editar</button>
                        <button onClick={() => handleDelete(s.id)} className="text-xs font-bold text-red-500 hover:text-red-600">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {socios.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{s.nombre} {s.apellido}</p>
                      <p className="text-xs text-slate-500 font-mono">{s.legajo}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.estado === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{s.estado}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-black text-emerald-600">{formatMoney(s.saldo_disponible)}</p>
                    <div className="space-x-2">
                      <button onClick={() => openEdit(s)} className="text-xs font-bold text-blue-600">Editar</button>
                      <button onClick={() => handleDelete(s.id)} className="text-xs font-bold text-red-500">Eliminar</button>
                    </div>
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
            <h3 className="text-lg font-bold text-slate-800 mb-5">{editingSocio ? 'Editar socio' : 'Nuevo socio'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                  <input type="text" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 transition-all" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Apellido</label>
                  <input type="text" value={form.apellido} onChange={(e) => setForm({...form, apellido: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 transition-all" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Legajo</label>
                  <input type="text" value={form.legajo} onChange={(e) => setForm({...form, legajo: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 transition-all font-mono" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Celular</label>
                  <input type="text" autoComplete="off" value={form.celular} onChange={(e) => setForm({...form, celular: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 transition-all" /></div>
              </div>
              {!editingSocio && (
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
                  <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 transition-all" /></div>
              )}
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Saldo inicial</label>
                <input type="number" value={form.saldo_disponible} onChange={(e) => setForm({...form, saldo_disponible: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-emerald-500 transition-all" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-40 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
