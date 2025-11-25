import { Alert } from '@/types';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { SeverityBadge } from './SeverityBadge';
import { ContractAddress } from './ContractAddress';
import { Eye, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  alert: Alert;
  onDismiss?: (id: string) => void;
  onViewDetails?: (alert: Alert) => void;
}

export const AlertCard = ({ alert, onDismiss, onViewDetails }: AlertCardProps) => {
  const severityColors = {
    CRITICAL: 'border-l-destructive',
    HIGH: 'border-l-warning',
    MEDIUM: 'border-l-accent',
    LOW: 'border-l-info',
  };

  return (
    <Card className={cn(
      "hover:shadow-sm transition-all duration-200 animate-fade-in border-l-4",
      severityColors[alert.severity]
    )}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={alert.severity} />
              <span className="text-sm font-medium">{alert.type.replace('_', ' ')}</span>
            </div>
            
            <p className="text-sm text-foreground leading-relaxed">{alert.description}</p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {alert.contractName && (
                <span className="font-medium">{alert.contractName}</span>
              )}
              <ContractAddress address={alert.contractAddress} showCopy={false} />
              <span>{formatDistanceToNow(alert.timestamp, { addSuffix: true })}</span>
            </div>
          </div>
          
          <div className="flex gap-1">
            {onViewDetails && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-muted/50"
                onClick={() => onViewDetails(alert)}
              >
                <Eye className="w-4 h-4" strokeWidth={1.5} />
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDismiss(alert.id)}
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
