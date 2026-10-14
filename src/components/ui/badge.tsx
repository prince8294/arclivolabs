import { cn } from '@/lib/utils/cn';
import { HTMLAttributes, forwardRef } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'outline' | 'destructive' | 'danger';
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-primary/10 text-primary border-primary/20',
      success: 'bg-success/10 text-success border-success/20',
      warning: 'bg-warning/10 text-warning border-warning/20',
      error: 'bg-destructive/10 text-destructive border-destructive/20',
      info: 'bg-info/10 text-info border-info/20',
      secondary: 'bg-secondary text-secondary-foreground border-secondary/20',
      outline: 'bg-background text-foreground border-border',
      destructive: 'bg-destructive/10 text-destructive border-destructive/20',
      danger: 'bg-destructive/10 text-destructive border-destructive/20',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
export default Badge;
