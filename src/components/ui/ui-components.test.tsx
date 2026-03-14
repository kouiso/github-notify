import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Spinner,
} from './index';

// ============================================================
// Badge
// ============================================================

describe('Badge', () => {
  describe('正常系', () => {
    it('子要素のテキストをレンダリングする', () => {
      render(<Badge>テスト</Badge>);
      expect(screen.getByText('テスト')).toBeInTheDocument();
    });

    it('デフォルトバリアントでレンダリングされる', () => {
      render(<Badge>default</Badge>);
      const el = screen.getByText('default');
      expect(el.className).toContain('bg-primary');
    });

    it('secondary バリアントのクラスが付与される', () => {
      render(<Badge variant="secondary">secondary</Badge>);
      const el = screen.getByText('secondary');
      expect(el.className).toContain('bg-secondary');
    });

    it('outline バリアントのクラスが付与される', () => {
      render(<Badge variant="outline">outline</Badge>);
      const el = screen.getByText('outline');
      expect(el.className).toContain('text-foreground');
    });

    it('destructive バリアントのクラスが付与される', () => {
      render(<Badge variant="destructive">destructive</Badge>);
      const el = screen.getByText('destructive');
      expect(el.className).toContain('bg-destructive');
    });

    it('追加の className が適用される', () => {
      render(<Badge className="custom-cls">badge</Badge>);
      const el = screen.getByText('badge');
      expect(el.className).toContain('custom-cls');
    });

    it('ref が DOM 要素に正しく渡される', () => {
      const ref = { current: null as HTMLDivElement | null };
      render(<Badge ref={ref}>ref-badge</Badge>);
      expect(ref.current).not.toBeNull();
    });
  });
});

// ============================================================
// Card ファミリー
// ============================================================

describe('Card', () => {
  describe('正常系', () => {
    it('Card がレンダリングされる', () => {
      render(<Card data-testid="card">中身</Card>);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('CardHeader がレンダリングされる', () => {
      render(<CardHeader data-testid="header">ヘッダー</CardHeader>);
      expect(screen.getByTestId('header')).toBeInTheDocument();
    });

    it('CardTitle がレンダリングされる', () => {
      render(<CardTitle>タイトル</CardTitle>);
      expect(screen.getByText('タイトル')).toBeInTheDocument();
    });

    it('CardDescription がレンダリングされる', () => {
      render(<CardDescription>説明文</CardDescription>);
      expect(screen.getByText('説明文')).toBeInTheDocument();
    });

    it('CardContent がレンダリングされる', () => {
      render(<CardContent data-testid="content">コンテンツ</CardContent>);
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('CardFooter がレンダリングされる', () => {
      render(<CardFooter data-testid="footer">フッター</CardFooter>);
      expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    it('全サブコンポーネントを組み合わせてレンダリングできる', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>見出し</CardTitle>
            <CardDescription>詳細説明</CardDescription>
          </CardHeader>
          <CardContent>本文</CardContent>
          <CardFooter>フッター</CardFooter>
        </Card>,
      );
      expect(screen.getByText('見出し')).toBeInTheDocument();
      expect(screen.getByText('詳細説明')).toBeInTheDocument();
      expect(screen.getByText('本文')).toBeInTheDocument();
      expect(screen.getByText('フッター')).toBeInTheDocument();
    });

    it('Card に追加 className が適用される', () => {
      render(
        <Card className="my-card" data-testid="card">
          内容
        </Card>,
      );
      expect(screen.getByTestId('card').className).toContain('my-card');
    });

    it('CardTitle が h3 要素としてレンダリングされる', () => {
      render(<CardTitle>タイトル</CardTitle>);
      const el = screen.getByText('タイトル');
      expect(el.tagName).toBe('H3');
    });

    it('CardDescription が p 要素としてレンダリングされる', () => {
      render(<CardDescription>説明</CardDescription>);
      const el = screen.getByText('説明');
      expect(el.tagName).toBe('P');
    });
  });
});

// ============================================================
// Dialog ファミリー
// ============================================================

describe('Dialog', () => {
  describe('正常系', () => {
    it('open=false のとき DialogContent が表示されない', () => {
      render(
        <Dialog open={false}>
          <DialogContent>
            <DialogTitle>タイトル</DialogTitle>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.queryByText('タイトル')).toBeNull();
    });

    it('open=true のとき DialogContent が表示される', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogTitle>ダイアログ</DialogTitle>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.getByText('ダイアログ')).toBeInTheDocument();
    });

    it('DialogTrigger クリックでダイアログが開く（非制御モード）', async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>開く</DialogTrigger>
          <DialogContent>
            <DialogTitle>内容</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.queryByText('内容')).toBeNull();
      await user.click(screen.getByText('開く'));
      expect(screen.getByText('内容')).toBeInTheDocument();
    });

    it('onOpenChange が制御コールバックとして呼ばれる', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Dialog open={false} onOpenChange={onOpenChange}>
          <DialogTrigger>開く</DialogTrigger>
          <DialogContent>
            <DialogTitle>制御ダイアログ</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText('開く'));
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('DialogClose クリックで onOpenChange(false) が呼ばれる', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Dialog open={true} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogTitle>内容</DialogTitle>
            <DialogClose>閉じる</DialogClose>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByText('閉じる'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('DialogHeader がレンダリングされる', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogHeader data-testid="dlg-header">
              <DialogTitle>タイトル</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.getByTestId('dlg-header')).toBeInTheDocument();
    });

    it('DialogFooter がレンダリングされる', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogTitle>タイトル</DialogTitle>
            <DialogFooter data-testid="dlg-footer">フッター内容</DialogFooter>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.getByTestId('dlg-footer')).toBeInTheDocument();
    });

    it('DialogDescription がレンダリングされる', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogTitle>タイトル</DialogTitle>
            <DialogDescription>補足説明</DialogDescription>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.getByText('補足説明')).toBeInTheDocument();
    });

    it('DialogTitle が h2 要素としてレンダリングされる', () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContent>
            <DialogTitle>見出し</DialogTitle>
          </DialogContent>
        </Dialog>,
      );
      const el = screen.getByText('見出し');
      expect(el.tagName).toBe('H2');
    });
  });

  describe('エラーケース', () => {
    it('Dialog の外で useDialogContext を呼ぶとエラーが投げられる', () => {
      // DialogTrigger は必ず Dialog 内で使う仕様
      // コンソールエラーを抑制してレンダリングのクラッシュを確認する
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(() => render(<DialogTrigger>孤立トリガー</DialogTrigger>)).toThrow(
        'Dialog components must be used within a Dialog',
      );

      consoleError.mockRestore();
    });
  });
});

// ============================================================
// Spinner
// ============================================================

describe('Spinner', () => {
  describe('正常系', () => {
    it('デフォルトサイズでレンダリングされる', () => {
      render(<Spinner data-testid="spinner" />);
      const el = screen.getByTestId('spinner');
      expect(el).toBeInTheDocument();
      expect(el.className).toContain('h-6');
      expect(el.className).toContain('w-6');
    });

    it('sm サイズのクラスが付与される', () => {
      render(<Spinner size="sm" data-testid="spinner" />);
      const el = screen.getByTestId('spinner');
      expect(el.className).toContain('h-4');
      expect(el.className).toContain('w-4');
    });

    it('lg サイズのクラスが付与される', () => {
      render(<Spinner size="lg" data-testid="spinner" />);
      const el = screen.getByTestId('spinner');
      expect(el.className).toContain('h-8');
      expect(el.className).toContain('w-8');
    });

    it('animate-spin クラスが常に付与される', () => {
      render(<Spinner data-testid="spinner" />);
      expect(screen.getByTestId('spinner').className).toContain('animate-spin');
    });

    it('追加の className が適用される', () => {
      render(<Spinner className="text-red-500" data-testid="spinner" />);
      expect(screen.getByTestId('spinner').className).toContain('text-red-500');
    });

    it('ref が DOM 要素に正しく渡される', () => {
      const ref = { current: null as HTMLDivElement | null };
      render(<Spinner ref={ref} data-testid="spinner" />);
      expect(ref.current).not.toBeNull();
    });
  });
});
