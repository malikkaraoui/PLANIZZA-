import * as React from 'react';
import { devError, devLog } from '../lib/devLog';
import { captureException, withScope } from '../lib/sentry';

/**
 * ErrorBoundary global : évite la "page blanche" en cas d'erreur runtime.
 * Affiche une UI minimale + logs dev (console) + report Sentry.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // React loggue déjà parfois, mais on force un log clair côté dev.
    devError('[ErrorBoundary] Uncaught error', error);
    devLog('[ErrorBoundary] Component stack:', info?.componentStack);

    // Envoyer à Sentry avec le component stack
    withScope((scope) => {
      scope.setExtra('componentStack', info?.componentStack);
      captureException(error);
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title || 'Oups… une erreur est survenue';

    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">{title}</div>
          <div className="mt-1 text-sm text-gray-600">
            La page a rencontré une erreur. Vous pouvez recharger.
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Recharger
          </button>

          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-5 whitespace-pre-wrap wrap-break-word rounded-xl bg-black/90 p-4 text-xs text-white overflow-auto">
              {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
