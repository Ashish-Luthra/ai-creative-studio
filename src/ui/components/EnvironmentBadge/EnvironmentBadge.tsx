import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface EnvironmentBadgeProps {
  environment: 'sandbox' | 'prod';
  /** Localised display label — defaults to capitalised environment value */
  label?: string;
  className?: string;
}

export function EnvironmentBadge({ environment, label, className = '' }: EnvironmentBadgeProps) {
  const isProd = environment === 'prod';
  const displayLabel = label ?? (environment.charAt(0).toUpperCase() + environment.slice(1));

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
        isProd
          ? 'bg-green-100 text-green-700 border border-green-200'
          : 'bg-blue-100 text-blue-700 border border-blue-200'
      } ${className}`}
      title={isProd ? 'Production Environment' : 'Sandbox Environment'}
    >
      {isProd ? (
        <AlertCircle size={12} className="text-green-600" />
      ) : (
        <CheckCircle2 size={12} className="text-blue-600" />
      )}
      <span>{displayLabel}</span>
    </div>
  );
}
