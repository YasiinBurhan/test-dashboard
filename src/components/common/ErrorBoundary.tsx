import React, { ErrorInfo, ReactNode } from 'react';
import { GlassCard } from './GlassCard';
import { Button } from './Button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in AzurLize App:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full text-center space-y-4 border-rose-500/30">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold text-white">Terjadi Kesalahan Sistem</h2>
            <p className="text-xs text-slate-400 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-left font-mono overflow-auto max-h-32">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button
              fullWidth
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Muat Ulang Aplikasi
            </Button>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}
