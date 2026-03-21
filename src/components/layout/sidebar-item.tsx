import { cn } from '@/lib/utils/cn';
import { EditIcon } from './sidebar-icons';

export interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  hasNotification?: boolean;
}

export function SidebarItem({
  icon,
  label,
  description,
  count,
  active,
  onClick,
  onEdit,
  hasNotification,
}: SidebarItemProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        title={description}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-left text-[0.9375rem]',
          active
            ? 'bg-accent text-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
        onClick={onClick}
      >
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <div className="flex items-center gap-1.5">
          {hasNotification && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
          )}
          {count !== undefined && count > 0 && (
            <span className="text-[0.8125rem] font-medium text-muted-foreground tabular-nums">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </div>
      </button>
      {onEdit && (
        <button
          type="button"
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="編集"
        >
          <EditIcon className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
