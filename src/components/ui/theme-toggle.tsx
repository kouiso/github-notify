import { useTheme } from '@/hooks';
import { cn } from '@/lib/utils/cn';
import { logger } from '@/lib/utils/logger';

interface ThemeToggleProps {
  variant?: 'button' | 'icon';
  className?: string;
}

const THEME_CONFIG = {
  light: { next: 'dark' as const, icon: '☀️', label: 'ライト' },
  dark: { next: 'system' as const, icon: '🌙', label: 'ダーク' },
  system: { next: 'light' as const, icon: '💻', label: 'システム' },
} as const;

export function ThemeToggle({ variant = 'button', className }: ThemeToggleProps) {
  const { theme, effectiveTheme, setTheme } = useTheme();

  const handleToggle = async () => {
    try {
      await setTheme(THEME_CONFIG[theme].next);
    } catch (error) {
      logger.error('Failed to update theme', { error });
    }
  };

  const currentConfig = THEME_CONFIG[theme];
  const displayIcon =
    theme === 'system'
      ? currentConfig.icon
      : THEME_CONFIG[effectiveTheme]?.icon || currentConfig.icon;

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={cn('p-2 rounded-md hover:bg-accent transition-colors', className)}
        aria-label={`テーマを切り替え: 現在${currentConfig.label}`}
        data-testid="theme-toggle-icon"
      >
        <span className="text-lg">{displayIcon}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-[0.9375rem]',
        className,
      )}
      title={`テーマ: ${currentConfig.label}`}
      aria-label={`テーマを切り替え: 現在${currentConfig.label}`}
      data-testid="theme-toggle-button"
    >
      <span className="text-lg">{displayIcon}</span>
      <span className="flex-1 text-left">{currentConfig.label}</span>
    </button>
  );
}
