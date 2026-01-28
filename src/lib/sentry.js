import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] DSN non configuré, monitoring désactivé');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    // Capture 100% des erreurs, 10% des transactions (ajuster selon le volume)
    tracesSampleRate: 0.1,

    // Replay pour reproduire les bugs (sessions avec erreur uniquement)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    // Intégrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Filtrer les erreurs non pertinentes
    ignoreErrors: [
      // Erreurs réseau courantes
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'NetworkError',
      // Extensions navigateur
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Script tiers
      'Script error.',
      // Annulations utilisateur
      'AbortError',
      'The operation was aborted',
    ],

    // Avant d'envoyer, filtrer les données sensibles
    beforeSend(event) {
      // Ne pas envoyer en dev local
      if (import.meta.env.DEV) {
        console.info('[Sentry] Event (DEV, non envoyé):', event);
        return null;
      }
      return event;
    },
  });
}

// Helpers pour capturer manuellement
export const captureException = Sentry.captureException;
export const captureMessage = Sentry.captureMessage;
export const setUser = Sentry.setUser;
export const withScope = Sentry.withScope;

// Export pour ErrorBoundary
export { Sentry };
