/**
 * Logging utility
 * Ready for future integration with error tracking services like Sentry
 * Based on pink-labo implementation with Tauri-specific adaptations
 */

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

  /**
   * Debug level logging (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return;
    // biome-ignore lint/suspicious/noConsole: debug logging is allowed
    console.debug(this.formatMessage('debug', message, undefined, context));
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    // biome-ignore lint/suspicious/noConsole: info logging is allowed
    console.info(this.formatMessage('info', message, undefined, context));
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    // biome-ignore lint/suspicious/noConsole: warn logging is allowed
    console.warn(this.formatMessage('warn', message, undefined, context));
  }

  /**
   * Error level logging
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const formattedMessage = this.formatMessage('error', message, error, context);

    // Development: use console.error with full details
    if (this.isDevelopment) {
      // biome-ignore lint/suspicious/noConsole: error logging is allowed
      console.error(formattedMessage, error);
    } else {
      // Production: ready for future error tracking service integration
      // Example: Sentry integration
      // if (typeof window !== 'undefined' && window.Sentry) {
      //   window.Sentry.captureException(error, {
      //     tags: context,
      //     extra: { message },
      //   });
      // }
      // biome-ignore lint/suspicious/noConsole: error logging is allowed
      console.error(formattedMessage, error);
    }
  }
}

export const logger = new Logger();
