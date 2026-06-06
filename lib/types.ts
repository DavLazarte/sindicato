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
  permite_negativo: boolean;
  tope_negativo: number | null;
  acumula_saldo: boolean;
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
  transacciones: Transaccion[];
  cuotas_pendientes?: Cuota[];
}

export interface DashboardPrestador {
  total_cobrado: number;
  cantidad_transacciones: number;
  transacciones: Transaccion[];
}

export interface DashboardAdmin {
  total_socios: number;
  total_prestadores: number;
  total_saldo_circulacion: number;
  transacciones_mes_cantidad: number;
  transacciones_mes_monto: number;
}
