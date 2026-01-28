import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { ref, get } from 'firebase/database';
import { db } from '../../lib/firebase';
import { CheckCircle, RefreshCw, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

/**
 * Page de retour après onboarding Stripe Connect.
 * Gère les cas: ?complete=true (succès) et ?refresh=true (reprise)
 */
export default function StripeOnboarding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState('loading'); // loading, complete, refresh, error
  const [truckName, setTruckName] = useState('');

  const isComplete = searchParams.get('complete') === 'true';
  const isRefresh = searchParams.get('refresh') === 'true';

  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        setStatus('error');
        return;
      }

      try {
        // Récupérer le profil pizzaiolo
        const pizzaioloSnap = await get(ref(db, `pizzaiolos/${user.uid}`));
        if (pizzaioloSnap.exists()) {
          const data = pizzaioloSnap.val();

          // Récupérer le nom du truck
          if (data.truckId) {
            const truckSnap = await get(ref(db, `trucks/${data.truckId}`));
            if (truckSnap.exists()) {
              setTruckName(truckSnap.val().name || '');
            }
          }

          // Vérifier si l'onboarding est vraiment complet
          if (isComplete && data.stripeOnboardingComplete) {
            setStatus('complete');
          } else if (isComplete) {
            // Stripe dit complete mais on n'a pas encore reçu le webhook
            // On montre quand même le succès, le webhook mettra à jour
            setStatus('complete');
          } else if (isRefresh) {
            setStatus('refresh');
          } else {
            setStatus('complete');
          }
        } else {
          setStatus('error');
        }
      } catch (err) {
        console.error('[StripeOnboarding] Erreur:', err);
        setStatus('error');
      }
    };

    checkStatus();
  }, [user, isComplete, isRefresh]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'refresh') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <RefreshCw className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Session expirée
          </h1>
          <p className="text-gray-600 mb-6">
            Votre session d'inscription Stripe a expiré. Pas de souci, vous pouvez reprendre là où vous en étiez.
          </p>
          <Button
            onClick={() => navigate('/pro/truck')}
            className="w-full"
          >
            Reprendre l'inscription
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Oups !
          </h1>
          <p className="text-gray-600 mb-6">
            Une erreur s'est produite. Veuillez vous reconnecter et réessayer.
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="w-full"
          >
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  // Status: complete
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-br from-green-50 to-emerald-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Bravo !
        </h1>

        <p className="text-xl text-green-600 font-semibold mb-4">
          Bienvenue dans l'aventure Planizza
        </p>

        <p className="text-gray-600 mb-2">
          Votre compte Stripe Connect est maintenant configuré.
          {truckName && (
            <span className="block mt-1 font-medium text-gray-900">
              {truckName}
            </span>
          )}
        </p>

        <p className="text-sm text-gray-500 mb-8">
          Vous pouvez désormais recevoir des paiements directement sur votre compte bancaire.
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => navigate('/pro/truck')}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Accéder à mon tableau de bord
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/pro/menu')}
            className="w-full"
          >
            Configurer mon menu
          </Button>
        </div>
      </div>
    </div>
  );
}
