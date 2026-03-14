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
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
