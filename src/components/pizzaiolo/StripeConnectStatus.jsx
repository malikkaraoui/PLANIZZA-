import { useState, useEffect } from 'react';
import { ref, get, onValue } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { CreditCard, ExternalLink, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import { Button } from '../ui/Button';
import Card from '../ui/Card';

/**
 * Composant affichant le statut Stripe Connect du pizzaiolo
 * et permettant l'onboarding si nécessaire.
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
      <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px]">
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

  return (
    <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px]">
      <div className="flex items-start gap-4">
        {/* Icône statut */}
        <div className={`p-3 rounded-2xl ${
          isActive
            ? 'bg-emerald-500/10'
            : needsAction
              ? 'bg-orange-500/10'
              : isPending
                ? 'bg-blue-500/10'
                : 'bg-gray-500/10'
        }`}>
          {isActive ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : needsAction ? (
            <AlertCircle className="h-6 w-6 text-orange-500" />
          ) : isPending ? (
            <Clock className="h-6 w-6 text-blue-500" />
          ) : (
            <CreditCard className="h-6 w-6 text-gray-500" />
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1">
          <h3 className="text-lg font-black tracking-tight">
            {isActive
              ? 'Paiements activés'
              : needsAction
                ? 'Action requise'
                : isPending
                  ? 'Vérification en cours'
                  : 'Configurer les paiements'}
          </h3>

          <p className="mt-1 text-sm text-muted-foreground font-medium">
            {isActive
              ? 'Vous pouvez recevoir des paiements de vos clients.'
              : needsAction
                ? 'Complétez votre profil Stripe pour recevoir les paiements.'
                : isPending
                  ? 'Stripe vérifie vos informations. Cela peut prendre 24-48h.'
                  : 'Configurez Stripe pour recevoir l\'argent de vos commandes.'}
          </p>

          {/* Liste des requirements si action requise */}
          {needsAction && requirements.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
              <p className="text-xs font-bold text-orange-600 mb-2">Documents manquants :</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {requirements.slice(0, 5).map((req) => (
                  <li key={req} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-orange-500" />
                    {requirementLabels[req] || req}
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

          {/* Erreur */}
          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex flex-wrap gap-3">
            {!hasAccount && (
              <Button
                onClick={handleCreateAccount}
                disabled={actionLoading}
                className="rounded-2xl font-bold bg-emerald-500 hover:bg-emerald-600"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Configuration...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Configurer Stripe
                  </>
                )}
              </Button>
            )}

            {hasAccount && !isActive && (
              <Button
                onClick={handleStartOnboarding}
                disabled={actionLoading}
                className={`rounded-2xl font-bold ${
                  needsAction
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {needsAction ? 'Compléter mon profil' : 'Continuer l\'inscription'}
                  </>
                )}
              </Button>
            )}

            {isActive && (
              <a
                href="https://dashboard.stripe.com/express"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 text-emerald-600 font-bold text-sm hover:bg-emerald-500/20 transition"
              >
                <ExternalLink className="h-4 w-4" />
                Voir mes revenus
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
