import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg';
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'animate-spin rounded-full border-2 border-current border-t-transparent',
          {
            'h-4 w-4': size === 'sm',
            'h-6 w-6': size === 'default',
            'h-8 w-8': size === 'lg',
          },
          className,
        )}
        {...props}
      />
    );
  },
);

Spinner.displayName = 'Spinner';

export { Spinner };
