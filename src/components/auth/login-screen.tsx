import { useCallback, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
} from '@/components/ui';
import type { DeviceFlowInfo } from '@/types';

interface LoginScreenProps {
  onStartDeviceFlow: () => Promise<DeviceFlowInfo>;
  onLoginWithToken: (token: string) => Promise<boolean>;
  deviceFlow: DeviceFlowInfo | null;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  onCancelDeviceFlow: () => void;
}

export function LoginScreen({
  onStartDeviceFlow,
  onLoginWithToken,
  deviceFlow,
  isLoading,
  isPolling,
  error,
  onCancelDeviceFlow,
}: LoginScreenProps) {
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = useCallback(async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      await onLoginWithToken(token.trim());
    }
  };

  if (deviceFlow && isPolling) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <CardTitle>GitHubアカウントを連携</CardTitle>
            <CardDescription>GitHubでこのコードを入力してアプリを認証してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <button
                type="button"
                className="text-4xl font-mono font-bold tracking-widest bg-muted p-4 rounded-lg w-full cursor-pointer hover:bg-muted/80 transition-colors select-all"
                onClick={() => handleCopyCode(deviceFlow.userCode)}
                title="クリックでコピー"
              >
                {deviceFlow.userCode}
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                {copied ? 'コピーしました!' : 'クリックでコピー'}
              </p>
            </div>

            <div className="text-center text-[0.9375rem] text-muted-foreground space-y-1">
              <p>ブラウザが自動的に開きます。</p>
              <p>開かない場合は、以下のURLにアクセスしてください：</p>
              <p className="font-mono text-primary">{deviceFlow.verificationUri}</p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[0.9375rem] text-muted-foreground">
              <Spinner size="sm" />
              <span>認証を待っています...</span>
            </div>

            <Button variant="ghost" className="w-full" onClick={onCancelDeviceFlow}>
              キャンセル
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showTokenInput) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Personal Access Tokenでログイン</CardTitle>
            <CardDescription>
              <code>repo</code> と <code>read:org</code> の権限を持つトークンを作成してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isLoading}
              />

              {error && <p className="text-[0.9375rem] text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowTokenInput(false)}
                >
                  戻る
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading || !token.trim()}>
                  {isLoading ? <Spinner size="sm" /> : 'ログイン'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">GitHub Notify</CardTitle>
          <CardDescription>GitHubにログインして通知を管理</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-[0.9375rem] text-destructive text-center">{error}</p>}

          <Button className="w-full" onClick={onStartDeviceFlow} disabled={isLoading}>
            {isLoading ? <Spinner size="sm" /> : 'GitHubでログイン'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-[0.75rem] uppercase font-semibold">
              <span className="bg-background px-2 text-muted-foreground">または</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={() => setShowTokenInput(true)}>
            Personal Access Tokenでログイン
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
