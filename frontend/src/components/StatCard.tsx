import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'mint' | 'lavender' | 'sky' | 'peach' | 'default';
  className?: string;
}

export const StatCard = ({ title, value, icon: Icon, trend, variant = 'default', className }: StatCardProps) => {
  const variantClasses = {
    mint: 'bg-stat-mint border-stat-mint',
    lavender: 'bg-stat-lavender border-stat-lavender',
    sky: 'bg-stat-sky border-stat-sky',
    peach: 'bg-stat-peach border-stat-peach',
    default: 'bg-card',
  };

  const iconVariantClasses = {
    mint: 'bg-stat-mint-foreground/10 text-stat-mint-foreground',
    lavender: 'bg-stat-lavender-foreground/10 text-stat-lavender-foreground',
    sky: 'bg-stat-sky-foreground/10 text-stat-sky-foreground',
    peach: 'bg-stat-peach-foreground/10 text-stat-peach-foreground',
    default: 'bg-muted text-foreground',
  };

  const textVariantClasses = {
    mint: 'text-stat-mint-foreground',
    lavender: 'text-stat-lavender-foreground',
    sky: 'text-stat-sky-foreground',
    peach: 'text-stat-peach-foreground',
    default: 'text-muted-foreground',
  };

  return (
    <Card className={cn('hover:shadow-sm transition-all duration-200 border-0', variantClasses[variant], className)}>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className={cn("text-sm mb-2", variant === 'default' ? 'text-muted-foreground' : textVariantClasses[variant])}>{title}</p>
              <p className="text-3xl font-geist font-bold">{value}</p>
            </div>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", iconVariantClasses[variant])}>
              <Icon className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>
          {trend && (
            <div className="flex items-center gap-1">
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
              <span className={cn(
                'text-sm font-medium',
                trend.isPositive ? 'text-success' : 'text-destructive'
              )}>
                {trend.value}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
