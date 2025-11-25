import { AlertSeverity } from '@/types';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface SeverityBadgeProps {
  severity: AlertSeverity;
  className?: string;
}

export const SeverityBadge = ({ severity, className }: SeverityBadgeProps) => {
  const variants = {
    CRITICAL: 'bg-destructive text-destructive-foreground hover:bg-destructive',
    HIGH: 'bg-warning text-warning-foreground hover:bg-warning',
    MEDIUM: 'bg-yellow-500 text-white hover:bg-yellow-500',
    LOW: 'bg-info text-info-foreground hover:bg-info',
  };

  return (
    <Badge className={cn('text-xs font-semibold uppercase', variants[severity], className)}>
      {severity}
    </Badge>
  );
};
