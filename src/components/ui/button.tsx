import { cn } from '@/lib/utils/cn';
import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Shared button styles, also used by `ButtonLink` so real links look
 * identical to buttons.
 */
export function buttonVariants(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md'
): string {
  const baseStyles =
    'inline-flex items-center justify-center gap-x-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary',
    secondary:
      'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary',
    outline:
      'border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent',
    ghost: 'hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent',
    danger:
      'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive',
    destructive:
      'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-11 px-8 text-lg',
  };

  return cn(baseStyles, variants[variant], sizes[size]);
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants(variant, size), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;
