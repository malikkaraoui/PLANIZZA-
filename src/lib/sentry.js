/**
 * Sentry – chargement conditionnel (lazy).
 *
 * On n'importe @sentry/react qu'au moment de l'init, pour éviter les
 * effets de bord au simple import (conflit scheduler / React 19).
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

let _Sentry = null;

export async function initSentry() {
  if (!SENTRY_DSN) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] DSN non configuré, monitoring désactivé');
    }
    return;
  }

  try {
    const Sentry = await import('@sentry/react');
    _Sentry = Sentry;

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      ignoreErrors: [
        'Network request failed',
        'Failed to fetch',
        'Load failed',
        'NetworkError',
        /^chrome-extension:\/\//,
        /^moz-extension:\/\//,
        'Script error.',
        'AbortError',
        'The operation was aborted',
      ],
      beforeSend(event) {
        if (import.meta.env.DEV) {
          console.info('[Sentry] Event (DEV, non envoyé):', event);
          return null;
        }
        return event;
      },
    });
  } catch (err) {
    console.warn('[Sentry] Initialisation échouée:', err);
  }
}

// Helpers – no-op si Sentry n'est pas chargé
export const captureException = (...args) => _Sentry?.captureException?.(...args);
export const captureMessage = (...args) => _Sentry?.captureMessage?.(...args);
export const setUser = (...args) => _Sentry?.setUser?.(...args);
export const withScope = (cb) => {
  if (_Sentry?.withScope) {
    _Sentry.withScope(cb);
  }
};
