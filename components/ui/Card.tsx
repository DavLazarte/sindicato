import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: boolean;
}

export default function Card({
  children,
  className,
  header,
  footer,
  padding = true,
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden',
        className
      )}
    >
      {header && (
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">
          {header}
        </div>
      )}
      <div className={cn(padding && 'p-5')}>{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
          {footer}
        </div>
      )}
    </div>
  );
}
