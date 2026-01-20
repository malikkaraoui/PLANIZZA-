import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { ref, update } from 'firebase/database';
import { db } from '../../lib/firebase';
import { ROUTES } from '../../app/routes';
import { Button } from '../../components/ui/Button';
import BackButton from '../../components/ui/BackButton';

function PricingCard({ title, subtitle, tagline, bullets }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">{title}</h3>
          {subtitle && <p className="mt-1 text-sm font-semibold text-emerald-600">{subtitle}</p>}
          {tagline && <p className="mt-3 text-sm text-gray-700">{tagline}</p>}
        </div>
      </div>

      <ul className="mt-6 space-y-2 text-sm text-gray-900">
        {bullets.map((b, idx) => (
          <li key={idx} className="flex gap-2">
            <span aria-hidden>✅</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PizzaioloStart() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBecomePizzaiolo = async () => {
    if (!isAuthenticated || !user?.uid) {
      navigate(ROUTES.login);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, {
        role: 'pizzaiolo',
        updatedAt: Date.now(),
      });

      // Redirection vers la création de camion
      navigate('/pro/creer-camion');
    } catch (err) {
      console.error('[PLANIZZA] Erreur upgrade pizzaiolo:', err);
      setError('Impossible de créer votre compte professionnel. Réessayez plus tard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <BackButton className="mb-6" />
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">
          🍕 Devenez Pizzaiolo sur PLANIZZA
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Créez votre camion, gérez votre menu et recevez des commandes en temps réel.
        </p>
      </div>

      {/* Avantages */}
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-3xl">🚚</div>
          <h3 className="mt-3 font-semibold text-gray-900">Votre camion</h3>
          <p className="mt-2 text-sm text-gray-600">
            Créez et personnalisez votre profil : logo, photos, badges (bio, terroir, halal...).
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-3xl">📋</div>
          <h3 className="mt-3 font-semibold text-gray-900">Menu dynamique</h3>
          <p className="mt-2 text-sm text-gray-600">
            Ajoutez vos pizzas, calzones, desserts. Modifiez prix et disponibilité en 1 clic.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-3xl">📦</div>
          <h3 className="mt-3 font-semibold text-gray-900">Commandes live</h3>
          <p className="mt-2 text-sm text-gray-600">
            Suivez les commandes en temps réel. Notifications instantanées à chaque paiement.
          </p>
        </div>
      </div>

      {/* Tarifs & Offres */}
      <div className="mt-16">
        <div className="text-center">
          <p className="text-sm font-semibold text-emerald-600">Nos offres</p>
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
            Des formules adaptées à votre camion
          </h2>
          <p className="mt-3 text-gray-700">
            Sans engagement — vous gardez la main sur vos horaires, votre menu et vos commandes.
          </p>
        </div>

        <div className="mt-8 grid gap-6">
          <PricingCard
            title="Vitrine"
            subtitle="Sans engagement"
            tagline="Gagnez en visibilité et recevez des clients autour de vous."
            bullets={[
              'Page camion publique (photos, logo, badges, horaires)',
              'Menu en ligne (pizzas / calzones / sucré)',
              'Localisation + itinéraire (Google/Apple Maps)',
              'Avis & note (étoiles) + mise en avant "Proche"',
              'Badges (Bio, Terroir, Sans gluten, Halal, Kasher, Sucré)',
              'Bouton "Commander" et "Appeler"',
            ]}
          />

          <PricingCard
            title="Commande + Paiement"
            subtitle="Le plus populaire"
            tagline="Encaissez en ligne et pilotez vos commandes depuis une seule interface."
            bullets={[
              'Tout le plan Vitrine',
              'Commande en ligne (panier, options, quantités, notes client)',
              'Paiement Stripe Checkout (one-shot)',
              'Statuts commande en temps réel : reçue → préparation → cuisson → prête',
              'Notifications (nouvelle commande / commande prête)',
              'Gestion de capacité : minutes/pizza + pizzas/heure (affiche un délai estimé)',
              'Créneaux & "pause service" (si rush / rupture)',
              'Historique commandes + stats simples (jour/semaine, best-sellers)',
            ]}
          />

          <PricingCard
            title="Commande + Caisse + TPE"
            subtitle="Sans engagement"
            tagline="Synchronisez la vente sur place et la vente en ligne, sans doublons."
            bullets={[
              'Tout le plan Commande + Paiement',
              'Mode caisse (vente comptoir) + tickets',
              'TPE relié (paiement sur place)',
              'Pourboire suggéré (optionnel)',
              'Clôture journée (export compta simple)',
              'Gestion produits/ruptures (masquer un item automatiquement)',
              'Multi-utilisateurs (si vous êtes plusieurs à servir)',
              'Rapports avancés (heures de pointe, temps moyen de préparation)',
            ]}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-8 text-center">
        {!isAuthenticated ? (
          <>
            <h2 className="text-xl font-semibold text-gray-900">
              Connectez-vous pour commencer
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Créez un compte gratuitement avec Google en quelques secondes.
            </p>
            <Button
              onClick={() => navigate(ROUTES.login)}
              className="mt-4"
            >
              Se connecter avec Google
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-gray-900">
              Prêt à rejoindre PLANIZZA ?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Vous allez pouvoir créer votre camion et commencer à recevoir des commandes.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              onClick={handleBecomePizzaiolo}
              disabled={loading}
              className="mt-4"
            >
              {loading ? 'Création en cours...' : 'Créer mon espace professionnel'}
            </Button>

            <p className="mt-3 text-xs text-gray-500">
              En cliquant, vous acceptez nos conditions d'utilisation.
            </p>
          </>
        )}
      </div>

      {/* Retour */}
      <div className="mt-8 text-center">
        <button
          onClick={() => navigate(ROUTES.explore)}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          ← Retour à l'exploration
        </button>
      </div>
    </div>
  );
}
