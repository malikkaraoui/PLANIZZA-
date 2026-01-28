import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { CreditCard, ExternalLink, AlertCircle, CheckCircle2, Clock, Loader2, Building2, FileCheck, Banknote, Shield } from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import { Button } from '../ui/Button';
import Card from '../ui/Card';

/**
 * Composant affichant le statut Stripe Connect du pizzaiolo
 * avec un stepper visuel clair pour l'onboarding.
 */
export default function StripeConnectStatus({ userId }) {
  const [stripeData, setStripeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Écouter les changements du profil pizzaiolo en temps réel
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const pizzaioloRef = ref(db, `pizzaiolos/${userId}`);

    const unsubscribe = onValue(pizzaioloRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setStripeData({
          accountId: data.stripeAccountId || null,
          status: data.stripeStatus || null,
          chargesEnabled: data.stripeChargesEnabled || false,
          payoutsEnabled: data.stripePayoutsEnabled || false,
          onboardingComplete: data.stripeOnboardingComplete || false,
          requirements: data.stripeRequirements || null,
        });
      } else {
        setStripeData(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('[StripeConnectStatus] Erreur:', err);
      setError('Erreur de chargement');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Créer un compte Connect
  const handleCreateAccount = async () => {
    if (!functions) {
      setError('Firebase Functions non disponible');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const createConnectedAccount = httpsCallable(functions, 'createConnectedAccount');
      const result = await createConnectedAccount({});

      console.log('[StripeConnect] Compte créé:', result.data);

      // Après création, lancer l'onboarding
      await handleStartOnboarding();
    } catch (err) {
      console.error('[StripeConnect] Erreur création:', err);
      if (err.code === 'functions/already-exists') {
        // Le compte existe déjà, lancer l'onboarding
        await handleStartOnboarding();
      } else {
        setError(err.message || 'Erreur lors de la création du compte');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Lancer/continuer l'onboarding
  const handleStartOnboarding = async () => {
    if (!functions) {
      setError('Firebase Functions non disponible');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const createOnboardingLink = httpsCallable(functions, 'createOnboardingLink');
      const result = await createOnboardingLink({});

      console.log('[StripeConnect] Lien onboarding:', result.data);

      // Rediriger vers Stripe
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch (err) {
      console.error('[StripeConnect] Erreur onboarding:', err);
      setError(err.message || 'Erreur lors de la création du lien');
    } finally {
      setActionLoading(false);
    }
  };

  // Affichage loading
  if (loading) {
    return (
      <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground font-medium">Chargement...</span>
        </div>
      </Card>
    );
  }

  // Déterminer l'état et l'affichage
  const hasAccount = stripeData?.accountId;
  const isActive = stripeData?.status === 'active' || (stripeData?.chargesEnabled && stripeData?.payoutsEnabled);
  const isPending = stripeData?.status === 'pending' || stripeData?.status === 'pending_verification';
  const needsAction = stripeData?.status === 'action_required' || stripeData?.status === 'restricted';
  const requirements = stripeData?.requirements?.currentlyDue || [];

  // Calculer l'étape actuelle (1-4)
  const getCurrentStep = () => {
    if (!hasAccount) return 1; // Pas de compte
    if (requirements.some(r => r.includes('individual.') && !r.includes('verification'))) return 2; // Infos personnelles
    if (requirements.some(r => r.includes('verification') || r.includes('external_account'))) return 3; // Vérification
    if (isActive) return 4; // Terminé
    return 3; // En cours de vérification
  };

  const currentStep = getCurrentStep();

  // Définir les étapes
  const steps = [
    {
      id: 1,
      label: 'Créer le compte',
      icon: CreditCard,
      description: 'Initialisation de votre compte Stripe'
    },
    {
      id: 2,
      label: 'Informations',
      icon: Building2,
      description: 'Identité et coordonnées professionnelles'
    },
    {
      id: 3,
      label: 'Vérification',
      icon: FileCheck,
      description: 'Documents et coordonnées bancaires'
    },
    {
      id: 4,
      label: 'Activé',
      icon: Banknote,
      description: 'Prêt à recevoir des paiements'
    },
  ];

  // Mapper les requirements en français
  const requirementLabels = {
    'individual.verification.document': "Pièce d'identité",
    'individual.verification.additional_document': 'Justificatif de domicile',
    'external_account': 'Coordonnées bancaires (IBAN)',
    'business_profile.url': 'URL du site web',
    'tos_acceptance.date': 'Acceptation des CGU',
    'individual.address.city': 'Ville',
    'individual.address.line1': 'Adresse',
    'individual.address.postal_code': 'Code postal',
    'individual.dob.day': 'Date de naissance',
    'individual.email': 'Email',
    'individual.first_name': 'Prénom',
    'individual.last_name': 'Nom',
    'individual.phone': 'Téléphone',
  };

  // Si paiements activés, affichage minimal
  if (isActive) {
    return (
      <Card className="glass-premium glass-glossy border-2 border-emerald-500/30 p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black tracking-tight text-emerald-600">
              Paiements activés
            </h3>
            <p className="text-sm text-muted-foreground font-medium">
              Vous pouvez recevoir des paiements de vos clients.
            </p>
          </div>
          <a
            href="https://dashboard.stripe.com/express"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition"
          >
            <ExternalLink className="h-4 w-4" />
            Voir mes revenus
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-premium glass-glossy border-2 border-orange-500/30 p-6 rounded-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-orange-500/10">
          <Shield className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h3 className="text-lg font-black tracking-tight">Configuration des paiements</h3>
          <p className="text-sm text-muted-foreground">
            {isPending
              ? 'Stripe vérifie vos informations (24-48h)'
              : 'Quelques étapes pour recevoir vos paiements'}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            const isPendingStep = isCurrent && isPending;

            return (
              <div key={step.id} className="flex items-center flex-1">
                {/* Step circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-all
                      ${isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                          ? isPendingStep
                            ? 'bg-blue-500 text-white animate-pulse'
                            : 'bg-orange-500 text-white ring-4 ring-orange-500/20'
                          : 'bg-gray-200 text-gray-400'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isPendingStep ? (
                      <Clock className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`
                    mt-2 text-xs font-bold text-center
                    ${isCompleted || isCurrent ? 'text-foreground' : 'text-muted-foreground'}
                  `}>
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div
                    className={`
                      flex-1 h-1 mx-2 rounded-full
                      ${step.id < currentStep ? 'bg-emerald-500' : 'bg-gray-200'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current step description */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
        <p className="text-sm font-medium">
          <span className="text-orange-500 font-bold">Étape {currentStep}/4 :</span>{' '}
          {steps[currentStep - 1]?.description}
        </p>

        {/* Liste des requirements si action requise */}
        {needsAction && requirements.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-xs font-bold text-orange-600 mb-2">Il vous reste à fournir :</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {requirements.slice(0, 5).map((req) => (
                <li key={req} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  {requirementLabels[req] || req.split('.').pop().replace(/_/g, ' ')}
                </li>
              ))}
              {requirements.length > 5 && (
                <li className="text-orange-600 font-medium">
                  + {requirements.length - 5} autre(s)...
                </li>
              )}
            </ul>
          </div>
        )}

        {isPending && (
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-blue-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs font-medium">Vérification en cours par Stripe...</span>
          </div>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Action button */}
      <Button
        onClick={hasAccount ? handleStartOnboarding : handleCreateAccount}
        disabled={actionLoading || isPending}
        className={`
          w-full rounded-2xl font-bold h-12
          ${isPending
            ? 'bg-blue-500 hover:bg-blue-600 opacity-50 cursor-not-allowed'
            : 'bg-orange-500 hover:bg-orange-600'
          }
        `}
      >
        {actionLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Chargement...
          </>
        ) : isPending ? (
          <>
            <Clock className="h-4 w-4 mr-2" />
            Vérification en cours...
          </>
        ) : (
          <>
            <ExternalLink className="h-4 w-4 mr-2" />
            {hasAccount ? 'Continuer sur Stripe' : 'Commencer la configuration'}
          </>
        )}
      </Button>

      {/* Info */}
      <p className="mt-3 text-xs text-center text-muted-foreground">
        Vous serez redirigé vers Stripe pour compléter votre inscription sécurisée.
      </p>
    </Card>
  );
}
