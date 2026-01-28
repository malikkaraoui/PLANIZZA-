import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { usePizzaioloProfile } from '../../features/users/hooks/usePizzaioloProfile';
import { ROUTES } from '../../app/routes';
import { Button } from '../../components/ui/Button';
import BackButton from '../../components/ui/BackButton';
import { ChefHat, Store, Radio, Utensils, TrendingUp, ListOrdered } from 'lucide-react';

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
  const { isPizzaiolo, truckId } = usePizzaioloProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Si l'utilisateur est déjà pizzaiolo, afficher le dashboard pro
  if (isPizzaiolo) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <BackButton className="mb-6" />

        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-linear-to-br from-orange-500 to-red-500 mb-6">
            <ChefHat className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900">
            Bienvenue Chef {user?.displayName?.split(' ')[0] || 'Pro'} ! 👨‍🍳
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Vous êtes déjà inscrit sur PLANIZZA. Gérez votre activité depuis votre espace pro.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Link
            to={ROUTES.pizzaioloLive}
            className="flex items-center gap-4 rounded-xl border-2 border-red-500 bg-linear-to-br from-red-50 to-white p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500">
              <Radio className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mode Live</h3>
              <p className="text-sm text-gray-600">Prendre des commandes sur place</p>
            </div>
          </Link>

          <Link
            to={ROUTES.pizzaioloOrders}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500">
              <ListOrdered className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Commandes Reçues</h3>
              <p className="text-sm text-gray-600">Gérer les commandes en ligne</p>
            </div>
          </Link>

          <Link
            to={ROUTES.pizzaioloProfile}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mon Camion</h3>
              <p className="text-sm text-gray-600">Profil, photos, horaires</p>
            </div>
          </Link>

          <Link
            to={ROUTES.pizzaioloMenu}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500">
              <Utensils className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mon Menu</h3>
              <p className="text-sm text-gray-600">Pizzas, prix, disponibilité</p>
            </div>
          </Link>
        </div>

        {/* Stats teaser */}
        <Link
          to={ROUTES.pizzaioloStats}
          className="mt-8 block rounded-xl border border-gray-200 bg-linear-to-br from-gray-50 to-white p-6 transition-all duration-300 hover:shadow-md hover:scale-[1.01]"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-gray-900">Statistiques</h3>
          </div>
          <p className="text-sm text-gray-600">
            Bientôt disponible : suivez vos ventes, vos best-sellers et votre activité en temps réel.
          </p>
        </Link>

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

  const handleBecomePizzaiolo = async () => {
    setLoading(true);
    setError('');

    try {
      // Si l'utilisateur est connecté (client ou guest), on le déconnecte
      // Car un compte PRO doit être un compte SÉPARÉ
      if (isAuthenticated && user) {
        console.log('[PLANIZZA] Déconnexion avant inscription pro (était:', user.email || 'guest', ')');
        await signOut(auth);
      }

      // Redirection vers le formulaire unifié de création camion
      navigate('/pro/creer-camion');
    } catch (err) {
      console.error('[PLANIZZA] Erreur déconnexion avant inscription pro:', err);
      setError('Erreur lors de la préparation. Veuillez réessayer.');
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

      {/* Avantages cliquables */}
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <button
          onClick={handleBecomePizzaiolo}
          disabled={loading}
          className="rounded-xl border-2 border-emerald-500 bg-linear-to-br from-emerald-50 to-white p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 text-left"
        >
          <div className="text-3xl">🚚</div>
          <h3 className="mt-3 font-semibold text-gray-900">Explorer une nouvelle route avec mon camion</h3>
          <p className="mt-2 text-sm text-gray-600">
            Créez et personnalisez votre profil : logo, photos, badges (bio, terroir, halal...).
          </p>
        </button>

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

      {/* Tarifs & Offres - Simplifié */}
      <div className="mt-16">
        <div className="text-center">
          <p className="text-sm font-semibold text-emerald-600">Notre offre unique</p>
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
            Tout ce dont vous avez besoin
          </h2>
          <p className="mt-3 text-gray-700">
            Sans engagement — vous gardez la main sur vos horaires, votre menu et vos commandes.
          </p>
        </div>

        <div className="mt-8 grid gap-6">
          <PricingCard
            title="Vitrine + Commande + Paiement"
            subtitle="Formule complète"
            tagline="Gagnez en visibilité, encaissez en ligne et pilotez vos commandes depuis une seule interface."
            bullets={[
              'Page camion publique (photos, logo, badges, horaires)',
              'Menu en ligne (pizzas / calzones / sucré)',
              'Localisation + itinéraire (Google/Apple Maps)',
              'Avis & note (étoiles) + mise en avant "Proche"',
              'Badges (Bio, Terroir, Sans gluten, Halal, Kasher, Sucré)',
              'Commande en ligne (panier, options, quantités, notes client)',
              'Paiement Stripe Checkout sécurisé',
              'Statuts commande en temps réel : reçue → préparation → cuisson → prête',
              'Notifications (nouvelle commande / commande prête)',
              'Gestion de capacité : minutes/pizza + pizzas/heure',
              'Créneaux & "pause service" (si rush / rupture)',
              'Historique commandes + stats simples (jour/semaine, best-sellers)',
            ]}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Prêt à rejoindre PLANIZZA ?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Créez votre camion et commencez à recevoir des commandes en quelques clics.
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
          {loading ? 'Chargement...' : '🚚 Explorer une nouvelle route avec mon camion'}
        </Button>

        <p className="mt-3 text-xs text-gray-500">
          En cliquant, vous acceptez nos conditions d'utilisation.
        </p>
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
