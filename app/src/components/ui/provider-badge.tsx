import { Badge } from '@/components/ui/badge';
import { PROVIDER_OPTIONS, type ModelProvider } from '@/types';

interface ProviderBadgeProps {
  provider?: ModelProvider;
  size?: 'sm' | 'default';
}

const PROVIDER_COLORS: Record<ModelProvider, string> = {
  meshy: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  hunyuan: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  tripo: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  rodin: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  hitem3d: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
};

/**
 * Colored badge displaying the provider/vendor name
 * Returns null for undefined provider (legacy data graceful fallback)
 */
export function ProviderBadge({ provider, size = 'default' }: ProviderBadgeProps) {
  if (!provider) return null;

  const providerConfig = PROVIDER_OPTIONS[provider];
  if (!providerConfig) return null;

  const colorClasses = PROVIDER_COLORS[provider];
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0' : '';

  return (
    <Badge variant="outline" className={`${colorClasses} ${sizeClasses}`}>
      {providerConfig.label}
    </Badge>
  );
}
