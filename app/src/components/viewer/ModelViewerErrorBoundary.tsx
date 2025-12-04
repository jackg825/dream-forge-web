'use client';

import { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  urlExpiredMessage?: string;
  loadErrorMessage?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for ModelViewer component
 * Catches Three.js loading errors (expired URLs, network failures, etc.)
 * and displays a friendly error message instead of crashing the page.
 */
export class ModelViewerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ModelViewer Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      const isExpiredUrl = this.state.error?.message?.includes('Failed to fetch') ||
                          this.state.error?.message?.includes('Could not load');

      const {
        fallbackMessage = '無法載入 3D 模型',
        urlExpiredMessage = '模型連結已過期，請重新整理頁面',
        loadErrorMessage = '載入時發生錯誤，請稍後再試',
        retryLabel = '重試',
      } = this.props;

      return (
        <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center border border-border/50">
          <div className="text-center p-6 max-w-sm">
            <div className="bg-destructive/10 p-3 rounded-full inline-block mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="font-medium mb-2">
              {fallbackMessage}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {isExpiredUrl ? urlExpiredMessage : loadErrorMessage}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {retryLabel}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
