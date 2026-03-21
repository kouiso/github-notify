import { Button } from '@/components/ui';
import type { CustomFilter } from '@/types';
import { REASON_LABELS } from '@/types';

export function NotificationFilterList({
  filters,
  onEdit,
  onDelete,
}: {
  filters: CustomFilter[];
  onEdit: (filter: CustomFilter) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {filters.map((filter) => (
        <div key={filter.id} className="p-3 border rounded-lg hover:bg-muted/50">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[0.9375rem]">{filter.name}</span>
                {filter.enableDesktopNotification && (
                  <span className="text-[0.75rem] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-semibold">
                    🔔
                  </span>
                )}
                {filter.enableSound && filter.enableDesktopNotification && (
                  <span className="text-[0.75rem] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
                    🔊
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {filter.reasons.map((reason) => (
                  <span
                    key={reason}
                    className="inline-block px-2 py-0.5 text-[0.75rem] font-medium bg-muted text-muted-foreground rounded"
                  >
                    {REASON_LABELS[reason]}
                  </span>
                ))}
              </div>
              {filter.repositories && filter.repositories.length > 0 && (
                <div className="text-[0.8125rem] text-muted-foreground font-medium mt-1">
                  📦 {filter.repositories.join(', ')}
                </div>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={() => onEdit(filter)}>
                編集
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(filter.id)}
                className="text-destructive hover:text-destructive"
              >
                削除
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
