import React from 'react';

interface Props {
  children: React.ReactNode;
  name: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#050a0f', color: '#ef4444',
          fontFamily: 'monospace', fontSize: 12, padding: 40,
          flexDirection: 'column', gap: 8,
        }}>
          <div style={{ color: '#f59e0b', fontSize: 14, fontWeight: 700 }}>
            {this.props.name} — Error
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#a1a1aa', maxHeight: 300, overflow: 'auto' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
