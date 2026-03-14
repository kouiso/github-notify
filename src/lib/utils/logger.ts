// 将来のエラートラッキングサービス（Sentry等）統合に備えたロギングユーティリティ

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    error?: unknown,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context
      ? ` [${Object.entries(context)
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(', ')}]`
      : '';
    const errorStr = error
      ? ` Error: ${error instanceof Error ? error.message : String(error)}`
      : '';

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}${errorStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return;
    // biome-ignore lint/suspicious/noConsole: ロギングユーティリティのため許可
    console.debug(this.formatMessage('debug', message, undefined, context));
  }

  info(message: string, context?: LogContext): void {
    // biome-ignore lint/suspicious/noConsole: ロギングユーティリティのため許可
    console.info(this.formatMessage('info', message, undefined, context));
  }

  warn(message: string, context?: LogContext): void {
    // biome-ignore lint/suspicious/noConsole: ロギングユーティリティのため許可
    console.warn(this.formatMessage('warn', message, undefined, context));
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    const formattedMessage = this.formatMessage('error', message, error, context);

    if (this.isDevelopment) {
      // biome-ignore lint/suspicious/noConsole: ロギングユーティリティのため許可
      console.error(formattedMessage, error);
    } else {
      // 本番環境: Sentry等のエラートラッキングサービス統合用の拡張ポイント
      // biome-ignore lint/suspicious/noConsole: ロギングユーティリティのため許可
      console.error(formattedMessage, error);
    }
  }
}

export const logger = new Logger();
