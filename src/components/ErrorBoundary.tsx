import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** When any value changes, a caught error is cleared so the child can render again. */
  resetKeys?: unknown[];
  /** Short label for what failed, e.g. the tool name. Used in the fallback copy. */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function isChunkLoadError(error: Error): boolean {
  const message = `${error.name} ${error.message}`;
  return /dynamically imported module|loading chunk|chunkloaderror|failed to fetch/i.test(message);
}

/**
 * Catches render errors and failed lazy chunk loads from a single tool view so
 * one broken tool cannot take down the whole app. Unexpected errors are logged
 * to the console, never swallowed silently.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Tool view failed to render.', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (!this.state.error) return;
    const prevKeys = prevProps.resetKeys ?? [];
    const nextKeys = this.props.resetKeys ?? [];
    const changed = prevKeys.length !== nextKeys.length
      || nextKeys.some((key, index) => !Object.is(key, prevKeys[index]));
    if (changed) this.setState({ error: null });
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkError = isChunkLoadError(error);
    const label = this.props.label ?? 'This tool';

    return (
      <div className="py-10 text-center" role="alert">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-extrabold text-ink">{label} hit a snag.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          {chunkError
            ? 'The tool files could not be loaded. This can happen right after the site updates — reloading the page usually fixes it.'
            : 'Something went wrong while showing this tool. Your files were not uploaded anywhere; you can try again or return to the toolbox.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {chunkError ? (
            <button type="button" onClick={this.handleReload} className="hub-button-primary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload page
            </button>
          ) : (
            <button type="button" onClick={this.handleRetry} className="hub-button-primary">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
          )}
          <Link className="hub-button-secondary" to="/">Back to all tools</Link>
        </div>
      </div>
    );
  }
}
