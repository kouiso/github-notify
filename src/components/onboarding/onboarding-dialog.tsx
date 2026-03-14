import { Dialog, DialogContent } from '@/components/ui';
import { useSettings } from '@/hooks';

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const { updateSettings } = useSettings();

  const handleComplete = async () => {
    await updateSettings({ onboardingCompleted: true });
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleComplete()}>
      <DialogContent className="max-w-lg">
        <div className="space-y-5 py-2">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold">GitHub Notify へようこそ</h2>
            <p className="text-sm text-muted-foreground">
              GitHub の通知をデスクトップで管理するアプリです
            </p>
          </div>

          <div className="space-y-3">
            <StepCard
              number="1"
              title="ダッシュボードを見る"
              description="毎朝ここを開くだけでOK。レビューすべきPRと自分のPRの状況がまとまっています。"
            />
            <StepCard
              number="2"
              title="通知が届いたらチェック"
              description="レビュー依頼やメンションが来ると、デスクトップ通知でお知らせします。常駐してるので見逃しません。"
            />
            <StepCard
              number="3"
              title="クリックでGitHubへ"
              description="気になる項目をクリックすると、そのままブラウザでGitHubが開きます。"
            />
          </div>

          <div className="rounded-lg bg-accent/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                基本はダッシュボードだけ見ればOKです。
              </span>
              <br />
              サイドバーのビューや設定はいつでも変更できるので、慣れてきたら試してみてください。
            </p>
          </div>

          <button
            onClick={handleComplete}
            className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            はじめる
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
