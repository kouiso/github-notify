import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// import.meta.env.DEV を制御するため、モジュールを動的インポートで扱う
// logger はシングルトンなので、isDevelopment の初期値をテストごとに変えるには
// vi.stubEnv で import.meta.env.DEV を差し替えてからモジュールを再インポートする

describe('Logger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(vi.fn());
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('開発環境（isDevelopment = true）', () => {
    beforeEach(() => {
      // @ts-expect-error -- import.meta.env.DEV は boolean だが stubEnv は string のみ受付
      vi.stubEnv('DEV', true);
    });

    it('info: console.info が正しいフォーマットで呼ばれる', async () => {
      const { logger } = await import('./logger');
      logger.info('テストメッセージ');

      expect(consoleInfoSpy).toHaveBeenCalledOnce();
      const calledWith = String(consoleInfoSpy.mock.calls[0][0]);
      expect(calledWith).toMatch(/\[INFO\]/);
      expect(calledWith).toContain('テストメッセージ');
    });

    it('info: コンテキスト付きで呼ばれる場合、フォーマット文字列にコンテキストが含まれる', async () => {
      const { logger } = await import('./logger');
      logger.info('テストメッセージ', { component: 'Header', action: 'mount' });

      const calledWith = String(consoleInfoSpy.mock.calls[0][0]);
      expect(calledWith).toContain('component=Header');
      expect(calledWith).toContain('action=mount');
    });

    it('warn: console.warn が [WARN] フォーマットで呼ばれる', async () => {
      const { logger } = await import('./logger');
      logger.warn('警告メッセージ');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const calledWith = String(consoleWarnSpy.mock.calls[0][0]);
      expect(calledWith).toMatch(/\[WARN\]/);
      expect(calledWith).toContain('警告メッセージ');
    });

    it('warn: コンテキスト付きでも正しくフォーマットされる', async () => {
      const { logger } = await import('./logger');
      logger.warn('警告', { component: 'Modal' });

      const calledWith = String(consoleWarnSpy.mock.calls[0][0]);
      expect(calledWith).toContain('component=Modal');
    });

    it('error: 開発環境では console.error がメッセージと error オブジェクト両方で呼ばれる', async () => {
      const { logger } = await import('./logger');
      const err = new Error('テストエラー');
      logger.error('エラーが発生', err);

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const calledArg0 = String(consoleErrorSpy.mock.calls[0][0]);
      expect(calledArg0).toMatch(/\[ERROR\]/);
      expect(calledArg0).toContain('エラーが発生');
      expect(calledArg0).toContain('テストエラー');
      expect(consoleErrorSpy.mock.calls[0][1]).toBe(err);
    });

    it('error: opt-in と endpoint がある場合はリモート診断イベントを送信する', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      const err = new Error('テストエラー');
      logger.error('エラーが発生', err, { component: 'Settings' });

      expect(reporter).toHaveBeenCalledOnce();
      expect(reporter.mock.calls[0][1]).toBe('https://errors.example.test/events');
      expect(reporter.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          level: 'error',
          message: 'エラーが発生',
          errorMessage: 'テストエラー',
          errorName: 'Error',
          context: { component: 'Settings' },
        }),
      );
    });

    it('error: リモート診断payloadのcontextは許可キーだけ送信する', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('エラーが発生', new Error('テストエラー'), {
        component: 'Settings',
        action: 'save',
        token: 'ghp_secret',
        notificationBody: '本文',
      });

      expect(reporter.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          context: { component: 'Settings', action: 'save' },
        }),
      );
      expect(reporter.mock.calls[0][0].formattedMessage).not.toContain('ghp_secret');
      expect(reporter.mock.calls[0][0].formattedMessage).not.toContain('notificationBody');
      expect(reporter.mock.calls[0][0].formattedMessage).not.toContain('本文');
    });

    it('error: opt-out の場合は endpoint があってもリモート診断イベントを送信しない', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({
        enabled: false,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('エラーが発生', new Error('テストエラー'));

      expect(reporter).not.toHaveBeenCalled();
    });

    it('error: endpoint 未設定の場合は opt-in でもリモート診断イベントを送信しない', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({ enabled: true, endpoint: null });

      logger.error('エラーが発生', new Error('テストエラー'));

      expect(reporter).not.toHaveBeenCalled();
    });

    it('error: endpoint null は環境変数のendpointより優先して送信を止める', async () => {
      vi.stubEnv('VITE_ERROR_REPORTING_ENDPOINT', 'https://errors.example.test/env');
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({ enabled: true, endpoint: null });

      logger.error('エラーが発生', new Error('テストエラー'));

      expect(reporter).not.toHaveBeenCalled();
    });

    it('error: デフォルト reporter は fetch にJSON payloadをPOSTする', async () => {
      const { configureRemoteErrorReporting, logger, resetRemoteErrorReportingForTest } =
        await import('./logger');
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchSpy);
      resetRemoteErrorReportingForTest();
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('エラーが発生', new Error('テストエラー'));
      await Promise.resolve();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://errors.example.test/events',
        expect.objectContaining({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          keepalive: true,
        }),
      );
      expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual(
        expect.objectContaining({
          level: 'error',
          message: 'エラーが発生',
          errorMessage: 'テストエラー',
        }),
      );
    });

    it('error: 初期状態のデフォルト reporter もfetchにPOSTする', async () => {
      const { configureRemoteErrorReporting, logger } = await import('./logger');
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchSpy);
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('初期reporter確認', new Error('テストエラー'));
      await Promise.resolve();

      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('error: デフォルト reporter はHTTPエラーステータスを送信失敗として扱う', async () => {
      const { configureRemoteErrorReporting, logger } = await import('./logger');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('HTTP失敗', new Error('テストエラー'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Remote error reporting failed',
        expect.objectContaining({
          message: 'Remote error reporting failed with status: 500',
        }),
      );
    });

    it('error: fetch が存在しない環境では初期状態のデフォルト reporter は何もしない', async () => {
      const { configureRemoteErrorReporting, logger } = await import('./logger');
      vi.stubGlobal('fetch', undefined);
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      expect(() => logger.error('fetchなし', new Error('テストエラー'))).not.toThrow();
    });

    it('error: reset 後のデフォルト reporter もfetchなし環境で何もしない', async () => {
      const { configureRemoteErrorReporting, logger, resetRemoteErrorReportingForTest } =
        await import('./logger');
      vi.stubGlobal('fetch', undefined);
      resetRemoteErrorReportingForTest();
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      expect(() => logger.error('fetchなし', new Error('テストエラー'))).not.toThrow();
    });

    it('error: Errorなしのリモート診断payloadも送信できる', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('エラーオブジェクトなし');

      expect(reporter.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          message: 'エラーオブジェクトなし',
          errorMessage: undefined,
          errorName: undefined,
          stack: undefined,
        }),
      );
    });

    it('error: Error以外の値もリモート診断payloadに文字列化する', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('文字列エラー', 'string error value');

      expect(reporter.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          message: '文字列エラー',
          errorMessage: 'string error value',
          errorName: undefined,
        }),
      );
    });

    it('error: { error } 形の引数からネストしたError詳細をリモート診断payloadへ保持する', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      const nestedError = new TypeError('テーマ更新失敗');
      logger.error('Failed to update theme', { error: nestedError });

      expect(reporter.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          message: 'Failed to update theme',
          errorMessage: 'テーマ更新失敗',
          errorName: 'TypeError',
          stack: nestedError.stack,
        }),
      );
    });

    it('error: ErrorBoundary の componentStack をリモート診断payloadへ保持する', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      const boundaryError = new Error('描画失敗');
      const componentStack = '\n    at SettingsDialog\n    at ErrorBoundary';
      logger.error('React ErrorBoundary caught error', {
        error: boundaryError,
        errorInfo: { componentStack },
      });

      expect(reporter.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          message: 'React ErrorBoundary caught error',
          errorMessage: '描画失敗',
          errorName: 'Error',
          stack: boundaryError.stack,
          componentStack,
        }),
      );
    });

    it('error: { error } 形でもネスト値がErrorでなければ従来どおり文字列化する', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reporter = vi
        .fn<Parameters<typeof setRemoteErrorReporterForTest>[0]>()
        .mockResolvedValue();
      setRemoteErrorReporterForTest(reporter);
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('Failed to update theme', { error: 'string nested error' });

      expect(reporter.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          message: 'Failed to update theme',
          errorMessage: '[object Object]',
          errorName: undefined,
        }),
      );
    });

    it('error: 開発環境ではリモート診断送信失敗をconsole.warnで可視化する', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      const reportingError = new Error('送信失敗');
      setRemoteErrorReporterForTest(vi.fn().mockRejectedValue(reportingError));
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('エラーが発生', new Error('テストエラー'));
      await Promise.resolve();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Remote error reporting failed', reportingError);
    });

    it('error: Error インスタンス以外のエラーも文字列変換されてフォーマットされる', async () => {
      const { logger } = await import('./logger');
      logger.error('エラー', 'string error value');

      const calledArg0 = String(consoleErrorSpy.mock.calls[0][0]);
      expect(calledArg0).toContain('string error value');
    });

    it('error: コンテキスト付きでも正しくフォーマットされる', async () => {
      const { logger } = await import('./logger');
      logger.error('エラー', undefined, { component: 'App' });

      const calledArg0 = String(consoleErrorSpy.mock.calls[0][0]);
      expect(calledArg0).toContain('component=App');
    });

    it('debug: 開発環境では console.debug が呼ばれる', async () => {
      const { logger } = await import('./logger');
      logger.debug('デバッグメッセージ');

      expect(consoleDebugSpy).toHaveBeenCalledOnce();
      const calledWith = String(consoleDebugSpy.mock.calls[0][0]);
      expect(calledWith).toMatch(/\[DEBUG\]/);
      expect(calledWith).toContain('デバッグメッセージ');
    });

    it('debug: コンテキスト付きで呼ばれる', async () => {
      const { logger } = await import('./logger');
      logger.debug('デバッグ', { action: 'fetch' });

      const calledWith = String(consoleDebugSpy.mock.calls[0][0]);
      expect(calledWith).toContain('action=fetch');
    });

    it('フォーマットにタイムスタンプ（ISO 8601）が含まれる', async () => {
      const { logger } = await import('./logger');
      logger.info('タイムスタンプ確認');

      const calledWith = String(consoleInfoSpy.mock.calls[0][0]);
      expect(calledWith).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('本番環境（isDevelopment = false）', () => {
    beforeEach(() => {
      // @ts-expect-error -- import.meta.env.DEV は boolean だが stubEnv は string のみ受付
      vi.stubEnv('DEV', false);
    });

    it('debug: 本番環境では console.debug は呼ばれない', async () => {
      const { logger } = await import('./logger');
      logger.debug('本番デバッグ');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('info: 本番環境でも console.info は呼ばれる', async () => {
      const { logger } = await import('./logger');
      logger.info('本番インフォ');

      expect(consoleInfoSpy).toHaveBeenCalledOnce();
    });

    it('warn: 本番環境でも console.warn は呼ばれる', async () => {
      const { logger } = await import('./logger');
      logger.warn('本番警告');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
    });

    it('error: 本番環境でも console.error は呼ばれる', async () => {
      const { logger } = await import('./logger');
      logger.error('本番エラー');

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });

    it('error: 本番環境ではリモート診断送信失敗をconsole.warnへ出さない', async () => {
      const { configureRemoteErrorReporting, logger, setRemoteErrorReporterForTest } = await import(
        './logger'
      );
      setRemoteErrorReporterForTest(vi.fn().mockRejectedValue(new Error('送信失敗')));
      configureRemoteErrorReporting({
        enabled: true,
        endpoint: 'https://errors.example.test/events',
      });

      logger.error('本番エラー', new Error('テストエラー'));
      await Promise.resolve();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('フォーマット詳細', () => {
    beforeEach(() => {
      // @ts-expect-error -- import.meta.env.DEV は boolean だが stubEnv は string のみ受付
      vi.stubEnv('DEV', true);
    });

    it('コンテキストなしの場合、key=value 形式のコンテキストブロックは含まれない', async () => {
      const { logger } = await import('./logger');
      logger.info('コンテキストなし');

      const calledWith = String(consoleInfoSpy.mock.calls[0][0]);
      expect(calledWith).not.toMatch(/\[[\w]+=[\w]+\]/);
    });

    it('複数コンテキストフィールドはカンマ区切りでフォーマットされる', async () => {
      const { logger } = await import('./logger');
      logger.info('複数コンテキスト', { component: 'A', action: 'B' });

      const calledWith = String(consoleInfoSpy.mock.calls[0][0]);
      expect(calledWith).toContain('component=A, action=B');
    });

    it('エラーなしの場合、Error: セクションは含まれない', async () => {
      const { logger } = await import('./logger');
      logger.info('エラーなし');

      const calledWith = String(consoleInfoSpy.mock.calls[0][0]);
      expect(calledWith).not.toContain('Error:');
    });

    it('エラーがオブジェクトの場合、toString() が使われる', async () => {
      const { logger } = await import('./logger');
      logger.error('エラー', { code: 404 });

      const calledArg0 = String(consoleErrorSpy.mock.calls[0][0]);
      expect(calledArg0).toContain('Error:');
    });
  });
});
