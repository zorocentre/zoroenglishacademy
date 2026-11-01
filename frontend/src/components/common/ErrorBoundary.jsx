import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught a render error:', error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.resetKey !== undefined && this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleGoDashboard = () => {
    const role = sessionStorage.getItem('zoro_user') 
      ? JSON.parse(sessionStorage.getItem('zoro_user') || '{}')?.role 
      : null;
    const roleUpper = (role || '').toUpperCase();
    if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
      window.location.href = '/admin';
    } else if (roleUpper === 'TRAINER') {
      window.location.href = '/trainer';
    } else {
      window.location.href = '/student';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-sm my-4">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/60 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Something went wrong
              </h2>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                An unexpected error occurred while loading this page. You can try refreshing the component or returning to your dashboard.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-900 text-slate-200 p-3.5 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-32 border border-slate-800">
                <span className="text-rose-400 font-bold block mb-1">Error:</span>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 hover:bg-blue-700 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-200 font-extrabold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
