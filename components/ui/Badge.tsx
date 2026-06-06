import { cn } from '@/lib/utils';

type BadgeVariant = 'activo' | 'inactivo' | 'suspendido' | 'pendiente' | 'aprobada' | 'anulada';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  activo: 'bg-emerald-100 text-emerald-700',
  aprobada: 'bg-emerald-100 text-emerald-700',
  inactivo: 'bg-slate-100 text-slate-600',
  suspendido: 'bg-amber-100 text-amber-700',
  pendiente: 'bg-blue-100 text-blue-700',
  anulada: 'bg-red-100 text-red-700',
};

export default function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
