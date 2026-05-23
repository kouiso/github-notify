// エラートラッキングサービス統合に備えたロギングユーティリティ

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  [key: string]: unknown;
}

interface RemoteErrorReportingConfig {
  enabled: boolean;
  endpoint?: string | null;
}

interface RemoteErrorPayload {
  level: 'error';
  message: string;
  formattedMessage: string;
  errorMessage?: string;
  errorName?: string;
  stack?: string;
  componentStack?: string;
  context?: Record<string, string>;
  timestamp: string;
}

type RemoteErrorReporter = (payload: RemoteErrorPayload, endpoint: string) => Promise<void>;

const getDefaultEndpoint = () => import.meta.env.VITE_ERROR_REPORTING_ENDPOINT || null;

let remoteErrorReportingConfig: RemoteErrorReportingConfig = {
  enabled: false,
  endpoint: getDefaultEndpoint(),
};

const defaultRemoteErrorReporter: RemoteErrorReporter = async (payload, endpoint) => {
  if (typeof fetch !== 'function') return;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error(`Remote error reporting failed with status: ${response.status}`);
  }
};

let remoteErrorReporter: RemoteErrorReporter = defaultRemoteErrorReporter;

const ALLOWED_REMOTE_CONTEXT_KEYS = new Set(['component', 'action']);

function extractErrorObject(error: unknown): Error | null {
  if (error instanceof Error) return error;

  if (error && typeof error === 'object' && 'error' in error) {
    const nestedError = (error as { error?: unknown }).error;
    return nestedError instanceof Error ? nestedError : null;
  }

  return null;
}

function formatErrorForPayload(error: unknown, errorObject: Error | null): string | undefined {
  if (errorObject) return errorObject.message;
  return error ? String(error) : undefined;
}

function extractComponentStack(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('errorInfo' in error)) return undefined;

  const errorInfo = (error as { errorInfo?: unknown }).errorInfo;
  if (!errorInfo || typeof errorInfo !== 'object' || !('componentStack' in errorInfo)) {
    return undefined;
  }

  const componentStack = (errorInfo as { componentStack?: unknown }).componentStack;
  return typeof componentStack === 'string' ? componentStack : undefined;
}

function sanitizeContextForRemote(context?: LogContext): Record<string, string> | undefined {
  if (!context) return undefined;

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    if (!ALLOWED_REMOTE_CONTEXT_KEYS.has(key)) continue;
    sanitized[key] = String(value);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function formatRemoteMessage(timestamp: string, message: string, errorMessage?: string): string {
  const errorStr = errorMessage ? ` Error: ${errorMessage}` : '';
  return `[${timestamp}] [ERROR] ${message}${errorStr}`;
}

export function configureRemoteErrorReporting(config: RemoteErrorReportingConfig): void {
  remoteErrorReportingConfig = {
    enabled: config.enabled,
    endpoint: 'endpoint' in config ? config.endpoint : getDefaultEndpoint(),
  };
}

export function setRemoteErrorReporterForTest(reporter: RemoteErrorReporter): void {
  remoteErrorReporter = reporter;
}

export function resetRemoteErrorReportingForTest(): void {
  remoteErrorReportingConfig = {
    enabled: false,
    endpoint: getDefaultEndpoint(),
  };
  remoteErrorReporter = defaultRemoteErrorReporter;
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

  private reportRemoteError(message: string, error?: unknown, context?: LogContext): void {
    const endpoint = remoteErrorReportingConfig.endpoint;
    if (!remoteErrorReportingConfig.enabled || !endpoint) return;

    const errorObject = extractErrorObject(error);
    const errorMessage = formatErrorForPayload(error, errorObject);
    const timestamp = new Date().toISOString();
    const payload: RemoteErrorPayload = {
      level: 'error',
      message,
      formattedMessage: formatRemoteMessage(timestamp, message, errorMessage),
      errorMessage,
      errorName: errorObject?.name,
      stack: errorObject?.stack,
      componentStack: extractComponentStack(error),
      context: sanitizeContextForRemote(context),
      timestamp,
    };

    void remoteErrorReporter(payload, endpoint).catch((reportingError) => {
      if (!this.isDevelopment) return;
      // biome-ignore lint/suspicious/noConsole: 開発時だけ送信失敗を可視化する
      console.warn('Remote error reporting failed', reportingError);
    });
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
    this.reportRemoteError(message, error, context);

    if (this.isDevelopment) {
      // biome-ignore lint/suspicious/noConsole: ロギングユーティリティのため許可
      console.error(formattedMessage, error);
    } else {
      // biome-ignore lint/suspicious/noConsole: ロギングユーティリティのため許可
      console.error(formattedMessage, error);
    }
  }
}

export const logger = new Logger();
