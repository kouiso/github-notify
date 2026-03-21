import { cn } from '@/lib/utils/cn';

export function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-10 h-[1.375rem] rounded-full transition-colors relative flex-shrink-0',
        enabled ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'absolute top-[0.1875rem] w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
          enabled ? 'translate-x-[1.25rem]' : 'translate-x-[0.1875rem]',
        )}
      />
    </button>
  );
}
