import { cn } from '@/lib/utils/cn';
import { HTMLAttributes } from 'react';

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  text?: string;
}

export default function LoadingState({ text = 'Loading...', className, ...props }: LoadingStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center p-12', className)}
      {...props}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="mt-4 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
