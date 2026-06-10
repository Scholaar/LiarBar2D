import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-base)',
          gap: 'var(--space-4)',
          padding: 'var(--space-6)',
          textAlign: 'center',
        }}>
          <AlertTriangle size={48} color="var(--accent)" />
          <h1 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}>
            出现了一些问题
          </h1>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            maxWidth: 400,
          }}>
            {this.state.error?.message || '发生了未知错误'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-6)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
