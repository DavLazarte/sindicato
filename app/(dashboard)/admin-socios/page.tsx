'use client';

import { TopBar } from '@/components/layout/Navigation';

export default function AdminSociosDashboard() {
  return (
    <>
      <TopBar title="Panel" subtitle="Administración de Socios" />
      <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-[2rem] flex items-center justify-center text-4xl mb-6 shadow-xl shadow-emerald-500/20">
          👋
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Bienvenido al Panel</h1>
        <p className="text-slate-500 max-w-sm">Desde aquí podés gestionar a los socios del sindicato, editar su información y resetear contraseñas.</p>
      </div>
    </>
  );
}
