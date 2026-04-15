// @vitest-environment jsdom
/**
 * アクセシビリティ自動チェック (axe-core)
 *
 * 判定基準: axe-core の critical / serious 違反が 0 件
 * §3.4 要件: axe-core 自動チェック critical/serious 0
 *
 * axe-core は jsdom 環境が必要なため @vitest-environment jsdom を指定
 */
import { createRequire } from 'node:module';
import { render } from '@testing-library/react';
import type { Axe } from 'axe-core';
import { describe, it, vi } from 'vitest';

import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';
import { Input } from './input';
import { Spinner } from './spinner';

/**
 * axe-core で critical/serious 違反がないことを検証するヘルパー
 * axe-core はCJS IIFEが `this` をグローバルとして使用するため、Vite の ESM 変換をバイパスして
 * createRequire で直接 CJS としてロードする。jsdom 環境下では window が存在するため動作する。
 */
async function expectNoA11yViolations(container: HTMLElement) {
  const require = createRequire(import.meta.url);
  const axe = require('axe-core') as Axe;

  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    },
  });

  const criticalOrSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  if (criticalOrSerious.length > 0) {
    const messages = criticalOrSerious
      .map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.description}\n  Help: ${v.helpUrl}\n  Elements: ${v.nodes.map((n) => n.html).join(', ')}`,
      )
      .join('\n');
    throw new Error(`アクセシビリティ違反 (critical/serious) が検出されました:\n${messages}`);
  }
}

// ============================================================
// Badge
// ============================================================

describe('Badge アクセシビリティ', () => {
  it('デフォルト Badge に critical/serious 違反がない', async () => {
    const { container } = render(<Badge>未読 3</Badge>);
    await expectNoA11yViolations(container);
  });

  it('secondary Badge に critical/serious 違反がない', async () => {
    const { container } = render(<Badge variant="secondary">ラベル</Badge>);
    await expectNoA11yViolations(container);
  });
});

// ============================================================
// Button
// ============================================================

describe('Button アクセシビリティ', () => {
  it('テキストラベル付き Button に critical/serious 違反がない', async () => {
    const { container } = render(<Button>既読にする</Button>);
    await expectNoA11yViolations(container);
  });

  it('disabled Button に critical/serious 違反がない', async () => {
    const { container } = render(<Button disabled>送信中</Button>);
    await expectNoA11yViolations(container);
  });

  it('aria-label 付きアイコン Button に critical/serious 違反がない', async () => {
    const { container } = render(
      <Button aria-label="設定を開く" size="icon">
        <span aria-hidden="true">⚙</span>
      </Button>,
    );
    await expectNoA11yViolations(container);
  });
});

// ============================================================
// Card
// ============================================================

describe('Card アクセシビリティ', () => {
  it('見出し構造を持つ Card に critical/serious 違反がない', async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>PR レビュー待ち</CardTitle>
          <CardDescription>レビューが必要な PR の一覧</CardDescription>
        </CardHeader>
        <CardContent>コンテンツ</CardContent>
      </Card>,
    );
    await expectNoA11yViolations(container);
  });
});

// ============================================================
// Input
// ============================================================

describe('Input アクセシビリティ', () => {
  it('label 付き Input に critical/serious 違反がない', async () => {
    const { container } = render(
      <div>
        <label htmlFor="search-input">リポジトリ検索</label>
        <Input id="search-input" type="search" placeholder="owner/repo" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it('aria-label 付き Input に critical/serious 違反がない', async () => {
    const { container } = render(
      <Input aria-label="個人アクセストークン" type="password" placeholder="ghp_..." />,
    );
    await expectNoA11yViolations(container);
  });
});

// ============================================================
// Spinner
// ============================================================

describe('Spinner アクセシビリティ', () => {
  it('aria-label 付き Spinner に critical/serious 違反がない', async () => {
    const { container } = render(<Spinner aria-label="読み込み中" />);
    await expectNoA11yViolations(container);
  });
});

// ============================================================
// Dialog
// ============================================================

describe('Dialog アクセシビリティ', () => {
  it('open=true の Dialog に critical/serious 違反がない', async () => {
    const { container } = render(
      <Dialog open={true} onOpenChange={vi.fn()}>
        <DialogContent>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>アプリの設定を変更します</DialogDescription>
          <Button>保存</Button>
        </DialogContent>
      </Dialog>,
    );
    await expectNoA11yViolations(container);
  });
});
