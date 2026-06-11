export type UserRole = 'admin' | 'socio' | 'prestador';

export interface User {
  id: number;
  name: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  estado: 'activo' | 'inactivo';
  socio?: Socio;
  prestador?: Prestador;
}

export interface Socio {
  id: number;
  user_id: number;
  legajo: string;
  nombre: string;
  apellido: string;
  celular: string | null;
  estado: 'activo' | 'inactivo' | 'suspendido';
  saldo_disponible: number;
  deposito_automatico: boolean;
  saldo_anterior: number;
  created_at: string;
  updated_at: string;
}

export interface Prestador {
  id: number;
  user_id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  estado: 'activo' | 'inactivo';
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Transaccion {
  id: number;
  socio_id: number;
  prestador_id: number;
  periodo_id: number;
  tipo: 'compra' | 'anulacion' | 'ajuste';
  monto_total: number;
  monto_cobrado: number;
  estado: 'pendiente' | 'confirmada' | 'anulada';
  es_cuotas: boolean;
  anulada_por: number | null;
  motivo_anulacion: string | null;
  created_at: string;
  updated_at: string;
  socio?: Socio;
  prestador?: Prestador;
  periodo?: Periodo;
  cuotas?: Cuota[];
}

export interface Movimiento {
  id: string;
  tipo: 'compra' | 'acreditacion' | 'cuota' | 'prestamo' | 'cuota_prestamo';
  titulo: string;
  monto: number;
  monto_cobrado?: number;
  signo: '+' | '-';
  estado: string;
  fecha: string;
}

export interface Cuota {
  id: number;
  transaccion_id: number;
  periodo_id: number | null;
  nro_cuota: number;
  monto: number;
  estado: 'pendiente' | 'cobrada' | 'anulada';
  cobrada_en: string | null;
  transaccion?: Transaccion;
  periodo?: Periodo;
}

export interface Acreditacion {
  id: number;
  socio_id: number;
  periodo_id: number;
  monto: number;
  estado: 'pendiente' | 'acreditado' | 'anulado';
  acreditado_por: number;
  created_at: string;
  socio?: Socio;
  periodo?: Periodo;
}

export interface Periodo {
  id: number;
  nombre: string;
  mes: number;
  anio: number;
  estado: 'abierto' | 'cerrado';
}

export interface Prestamo {
  id: number;
  socio_id: number;
  monto_total: number;
  cantidad_cuotas: number;
  monto_cuota: number;
  cuotas_pagadas: number;
  estado: 'vigente' | 'finalizado' | 'cancelado';
  aprobado_por: number;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  socio?: Socio;
  cuotas_prestamo?: CuotaPrestamo[];
  aprobador?: User;
}

export interface CuotaPrestamo {
  id: number;
  prestamo_id: number;
  nro_cuota: number;
  monto: number;
  estado: 'pendiente' | 'pagada' | 'anulada';
  periodo_id: number | null;
  pagada_en: string | null;
  periodo?: Periodo;
  prestamo?: Prestamo;
}

export interface AuditLog {
  id: number;
  user_id: number;
  accion: string;
  modelo: string;
  modelo_id: number;
  valores_antes: Record<string, unknown> | null;
  valores_despues: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
  user?: User;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
  description: string | null;
}

// ─── API Response types ─────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedData<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface DashboardSocio {
  saldo_disponible: number;
  nombre: string;
  apellido: string;
  legajo: string;
  estado: string;
  movimientos: Movimiento[];
  cuotas_pendientes?: Cuota[];
  cuotas_pendientes?: Cuota[];
  prestamos_vigentes?: Prestamo[];
}

export interface DashboardPrestador {
  total_cobrado: number;
  cantidad_transacciones: number;
  transacciones: Transaccion[];
  cuotas_pendientes?: Cuota[];
  cuotas_cobradas?: Cuota[];
}

export interface DashboardAdmin {
  total_socios: number;
  total_prestadores: number;
  total_saldo_circulacion: number;
  transacciones_mes_cantidad: number;
  transacciones_mes_monto: number;
  prestamos_vigentes: number;
  ultimas_acreditaciones?: Acreditacion[];
}
