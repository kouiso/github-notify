import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/utils/logger';
import { ThemeToggle } from './theme-toggle';

// useThemeフックをモック
const mockUseTheme = vi.fn();

vi.mock('@/hooks', () => ({
  useTheme: () => mockUseTheme(),
}));

// loggerをモック
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('light テーマのとき、正しいアイコンとラベルを表示する', () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        setTheme: vi.fn(),
      });

      render(<ThemeToggle />);

      expect(screen.getByText('☀️')).toBeInTheDocument();
      expect(screen.getByText('ライト')).toBeInTheDocument();
      expect(screen.getByTitle('テーマ: ライト')).toBeInTheDocument();
    });

    it('dark テーマのとき、正しいアイコンとラベルを表示する', () => {
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        effectiveTheme: 'dark',
        setTheme: vi.fn(),
      });

      render(<ThemeToggle />);

      expect(screen.getByText('🌙')).toBeInTheDocument();
      expect(screen.getByText('ダーク')).toBeInTheDocument();
      expect(screen.getByTitle('テーマ: ダーク')).toBeInTheDocument();
    });

    it('system テーマのとき、正しいアイコンとラベルを表示する', () => {
      mockUseTheme.mockReturnValue({
        theme: 'system',
        effectiveTheme: 'dark',
        setTheme: vi.fn(),
      });

      render(<ThemeToggle />);

      expect(screen.getByText('💻')).toBeInTheDocument();
      expect(screen.getByText('システム')).toBeInTheDocument();
      expect(screen.getByTitle('テーマ: システム')).toBeInTheDocument();
    });

    it('ボタンクリックで light → dark に切り替わる', async () => {
      const mockSetThemeLocal = vi.fn().mockResolvedValue(undefined);
      mockUseTheme.mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        setTheme: mockSetThemeLocal,
      });

      const user = userEvent.setup();
      render(<ThemeToggle />);

      const button = screen.getByTestId('theme-toggle-button');
      await user.click(button);

      expect(mockSetThemeLocal).toHaveBeenCalledWith('dark');
      expect(mockSetThemeLocal).toHaveBeenCalledTimes(1);
    });

    it('ボタンクリックで dark → system に切り替わる', async () => {
      const mockSetThemeLocal = vi.fn().mockResolvedValue(undefined);
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        effectiveTheme: 'dark',
        setTheme: mockSetThemeLocal,
      });

      const user = userEvent.setup();
      render(<ThemeToggle />);

      const button = screen.getByTestId('theme-toggle-button');
      await user.click(button);

      expect(mockSetThemeLocal).toHaveBeenCalledWith('system');
      expect(mockSetThemeLocal).toHaveBeenCalledTimes(1);
    });

    it('ボタンクリックで system → light に切り替わる', async () => {
      const mockSetThemeLocal = vi.fn().mockResolvedValue(undefined);
      mockUseTheme.mockReturnValue({
        theme: 'system',
        effectiveTheme: 'dark',
        setTheme: mockSetThemeLocal,
      });

      const user = userEvent.setup();
      render(<ThemeToggle />);

      const button = screen.getByTestId('theme-toggle-button');
      await user.click(button);

      expect(mockSetThemeLocal).toHaveBeenCalledWith('light');
      expect(mockSetThemeLocal).toHaveBeenCalledTimes(1);
    });

    it('aria-label が正しく設定される', () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        setTheme: vi.fn(),
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toBe('テーマを切り替え: 現在ライト');
    });

    it('type="button" が設定される（フォーム誤送信防止）', () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        setTheme: vi.fn(),
      });

      render(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button.getAttribute('type')).toBe('button');
    });
  });

  describe('境界値・特殊ケース', () => {
    it('variant="icon" のとき、ラベルなしでアイコンのみ表示', () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        setTheme: vi.fn(),
      });

      render(<ThemeToggle variant="icon" />);

      expect(screen.getByText('☀️')).toBeInTheDocument();
      expect(screen.queryByText('ライト')).toBeNull();
      expect(screen.getByTestId('theme-toggle-icon')).toBeInTheDocument();
    });

    it('variant="icon" でもクリックでテーマが切り替わる', async () => {
      const mockSetThemeLocal = vi.fn().mockResolvedValue(undefined);
      mockUseTheme.mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        setTheme: mockSetThemeLocal,
      });

      const user = userEvent.setup();
      render(<ThemeToggle variant="icon" />);

      const button = screen.getByTestId('theme-toggle-icon');
      await user.click(button);

      expect(mockSetThemeLocal).toHaveBeenCalledWith('dark');
    });

    it('className が正しく適用される', () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        setTheme: vi.fn(),
      });

      render(<ThemeToggle className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('custom-class');
    });
  });

  describe('エラーハンドリング', () => {
    it('setTheme がエラーを投げても UI がクラッシュしない', async () => {
      const mockSetThemeLocal = vi.fn().mockRejectedValue(new Error('Failed to save theme'));
      mockUseTheme.mockReturnValue({
        theme: 'light',
        effectiveTheme: 'light',
        setTheme: mockSetThemeLocal,
      });

      const user = userEvent.setup();
      render(<ThemeToggle />);

      const button = screen.getByTestId('theme-toggle-button');
      await user.click(button);

      // エラーがログに記録される
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to update theme',
        expect.objectContaining({ error: expect.any(Error) }),
      );

      // UIはクラッシュしない（ボタンは引き続き存在する）
      expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
    });
  });
});
