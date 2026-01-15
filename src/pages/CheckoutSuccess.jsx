import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { useAuth } from '../app/providers/AuthProvider';
import { db } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId');
  const { clear } = useCart();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [webhookReceived, setWebhookReceived] = useState(false);
  const [minPendingReached, setMinPendingReached] = useState(false);
  const [progress, setProgress] = useState(0);
  const [redirectInSec, setRedirectInSec] = useState(5);

  // Vue finale calculée : on n'affiche le succès que si le webhook est reçu ET qu'on a attendu au moins 3s
  const isPaid = webhookReceived && minPendingReached;

  useEffect(() => {
    // UX: on vide le panier local après un paiement réussi.
    clear();
  }, [clear]);

  // UX prod: cette page ne doit jamais rester plus de 5s.
  // On redirige vers le suivi (qui peut afficher l'état "pending" tant que le webhook Stripe n'est pas passé).
  useEffect(() => {
    const deadlineMs = Date.now() + 5000;

    const tick = () => {
      const left = Math.max(0, deadlineMs - Date.now());
      const sec = Math.ceil(left / 1000);
      setRedirectInSec(sec);
      if (left <= 0) {
        if (orderId) {
          navigate(ROUTES.order(orderId), { replace: true });
        } else {
          navigate(ROUTES.explore, { replace: true });
        }
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [orderId, navigate]);

  useEffect(() => {
    if (!orderId) return;

    const orderRef = ref(db, `orders/${orderId}`);
    const unsub = onValue(orderRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        if (data.status === 'received' || data.paidAt) {
          setWebhookReceived(true);
        }
      }
    });

    return () => unsub();
  }, [orderId]);

  // Forcer l'affichage "En cours" pendant au moins 3 secondes pour inspirer confiance
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinPendingReached(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Animation de progression sur 5 secondes une fois payé
  useEffect(() => {
    if (!isPaid) return;

    const duration = 5000; // 5 secondes
    const interval = 50; // mise à jour toutes les 50ms
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + step;
        if (newProgress >= 100) {
          clearInterval(timer);
          return 100;
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPaid]);

  // Navigation séparée quand le progress atteint 100%
  useEffect(() => {
    if (progress >= 100 && isPaid && orderId) {
      navigate(ROUTES.order(orderId));
    }
  }, [progress, isPaid, orderId, navigate]);

  const isGuest = !isAuthenticated;

  // Si on charge encore l'auth, on affiche un squelette ou un micro-loading pour éviter le flash "Invité"
  if (authLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600" />
        <p className="mt-4 text-gray-500">Validation de votre session...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <div className="mb-6 flex justify-center text-6xl">
        {isPaid ? '🍕' : '💳'}
      </div>
      <h1 className="text-4xl font-extrabold text-gray-900 transition-all">
        {isPaid ? 'Paiement validé !' : 'Commande en cours de validation'}
      </h1>
      <p className="mt-3 text-gray-600">
        {isPaid
          ? "Génial ! Votre paiement a été confirmé. Préparez vos couverts !"
          : "Merci ! Votre paiement a été envoyé. Nous attendons la confirmation finale de Stripe (cela prend quelques secondes)."}
      </p>

      <p className="mt-2 text-sm text-gray-500">
        Redirection automatique dans <span className="font-semibold">{redirectInSec}s</span>…
      </p>

      {/* On n'affiche le bloc de création de compte que si on est CERTAIN d'être guest et que le paiement n'est pas encore redirigé */}
      {isGuest && !isPaid && (
        <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6 max-w-md mx-auto animate-in fade-in duration-500">
          <h2 className="text-xl font-bold text-emerald-900 mb-2">🎉 Créez un compte pour suivre votre commande !</h2>
          <p className="text-sm text-emerald-800 mb-4">
            En créant un compte, vous pourrez suivre votre commande en temps réel (préparation, cuisson...) et retrouver votre historique.
          </p>
          <Link
            to={ROUTES.register}
            className="inline-block rounded-md bg-emerald-600 px-6 py-3 text-white font-semibold hover:bg-emerald-700 transition-colors"
          >
            Créer mon compte
          </Link>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center justify-center gap-3">
          <Link
            to={ROUTES.explore}
            className="rounded-md bg-gray-900 px-6 py-2.5 text-white font-semibold hover:bg-gray-800 transition-colors"
          >
            Revenir à l’exploration
          </Link>

          {orderId && (
            <Link
              to={ROUTES.order(orderId)}
              className={`relative overflow-hidden rounded-md px-6 py-2.5 font-semibold transition-all duration-300 ${isPaid
                ? 'text-white'
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              style={{
                backgroundColor: isPaid ? '#10b981' : undefined, // emerald-500 base
              }}
            >
              {/* Overlay de progression */}
              {isPaid && (
                <div
                  className="absolute inset-0 bg-emerald-700 transition-all duration-75 ease-linear"
                  style={{ width: `${progress}%`, opacity: 0.4 }}
                />
              )}
              <span className="relative z-10">
                {isPaid ? 'Suivre ma commande' : 'Suivre ma commande'}
              </span>
            </Link>
          )}
        </div>

        {isPaid && (
          <p className="text-sm text-emerald-600 font-medium animate-pulse">
            Patientez encore un instant, redirection automatique...
          </p>
        )}
      </div>
    </div>
  );
}
