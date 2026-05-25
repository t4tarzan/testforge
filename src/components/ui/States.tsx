import { AlertCircle, RefreshCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';

// ═══════════════════════════════════════════════════
// Empty State Component
// ═══════════════════════════════════════════════════
export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="mb-4 text-[#9A9A9A]">{icon}</div>}
      <h3 className="text-lg font-semibold text-[#12101A] mb-2">{title}</h3>
      <p className="text-sm text-[#6B6B6B] max-w-[400px] mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2 bg-[#574a7d] text-white rounded-lg text-sm font-medium hover:bg-[#4a3d6b] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════
export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-[#ECEBF5] rounded w-3/4 mb-2" />
          <div className="h-3 bg-[#ECEBF5] rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Error Boundary
// ═══════════════════════════════════════════════════
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <AlertCircle size={48} className="text-[#D4524A] mb-4" />
          <h2 className="text-xl font-semibold text-[#12101A] mb-2">Something went wrong</h2>
          <p className="text-sm text-[#6B6B6B] mb-4 max-w-[400px] text-center">
            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2 bg-[#574a7d] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#4a3d6b] transition-colors"
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
