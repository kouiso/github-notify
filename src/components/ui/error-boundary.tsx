import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { logger } from '@/lib/utils/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('React ErrorBoundary caught error', { error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold">予期しないエラーが発生しました</h1>
            <p className="text-muted-foreground">
              {this.state.error?.message || 'アプリケーションでエラーが発生しました'}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
