import { Button } from '@/components/ui';
import type { FilterTemplate } from '@/types';

export function FilterTemplates({
  onAddFilter,
}: {
  onAddFilter: (template: FilterTemplate) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.8125rem] font-bold text-muted-foreground uppercase tracking-wide">
        おすすめテンプレート:
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onAddFilter({
              name: 'レビュー依頼',
              description: 'PRのレビューを依頼された時',
              reasons: ['review_requested'],
              enableDesktopNotification: true,
              enableSound: true,
              soundType: 'default',
            })
          }
          className="h-auto py-3 flex flex-col items-start"
        >
          <span className="font-semibold text-[0.9375rem]">📝 レビュー依頼</span>
          <span className="text-[0.8125rem] text-muted-foreground">PRレビューが必要</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onAddFilter({
              name: 'メンション',
              description: '@で名前を呼ばれた時',
              reasons: ['mention', 'team_mention'],
              enableDesktopNotification: true,
              enableSound: true,
              soundType: 'default',
            })
          }
          className="h-auto py-3 flex flex-col items-start"
        >
          <span className="font-semibold text-[0.9375rem]">💬 メンション</span>
          <span className="text-[0.8125rem] text-muted-foreground">@で呼ばれた時</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onAddFilter({
              name: 'アサイン',
              description: 'Issue/PRにアサインされた時',
              reasons: ['assign'],
              enableDesktopNotification: true,
              enableSound: true,
              soundType: 'soft',
            })
          }
          className="h-auto py-3 flex flex-col items-start"
        >
          <span className="font-semibold text-[0.9375rem]">👤 アサイン</span>
          <span className="text-[0.8125rem] text-muted-foreground">担当になった時</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onAddFilter({
              name: '重要な通知',
              description: 'レビュー依頼・メンション・アサイン',
              reasons: ['review_requested', 'mention', 'team_mention', 'assign'],
              enableDesktopNotification: true,
              enableSound: true,
              soundType: 'default',
            })
          }
          className="h-auto py-3 flex flex-col items-start border-primary/50"
        >
          <span className="font-semibold text-[0.9375rem]">⭐ 重要な通知</span>
          <span className="text-[0.8125rem] text-muted-foreground">まとめて追加</span>
        </Button>
      </div>
    </div>
  );
}
