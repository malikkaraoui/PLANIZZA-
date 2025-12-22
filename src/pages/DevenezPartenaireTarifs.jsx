import PartnerTapbar from '../components/partner/PartnerTapbar';
import { Button } from '../components/ui/Button';

function Card({ title, subtitle, tagline, cta, bullets }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-gray-900">{title}</h3>
          {subtitle && <p className="mt-1 text-sm font-semibold text-gray-700">{subtitle}</p>}
          {tagline && <p className="mt-3 text-sm text-gray-700">{tagline}</p>}
        </div>
      </div>

      <div className="mt-5">
        <Button className="w-full">{cta}</Button>
      </div>

      <ul className="mt-6 space-y-2 text-sm text-gray-900">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span aria-hidden>✅</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DevenezPartenaireTarifs() {
  return (
    <div>
      <PartnerTapbar />

      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm font-semibold text-gray-700">Titre de section</p>
        <h1 className="mt-2 text-3xl font-extrabold text-gray-900">
          Des offres Pizza Commande adaptées à votre camion à pizza
        </h1>
        <p className="mt-3 text-gray-700">
          Sans engagement — vous gardez la main sur vos horaires, votre menu et vos commandes.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Note : côté clients (explorateurs), l’app reste gratuite (pas d’abonnement). Le pricing concerne le vendeur.
        </p>

        <div className="mt-8 grid gap-6">
          <Card
            title="Vitrine"
            subtitle="Sans engagement"
            tagline="Gagnez en visibilité et recevez des clients autour de vous."
            cta="Échanger avec un conseiller"
            bullets={[
              'Page camion publique (photos, logo, badges, horaires)',
              'Menu en ligne (pizzas / calzones / sucré)',
              'Localisation + itinéraire (Google/Apple Maps)',
              'Avis & note (étoiles) + mise en avant “Proche”',
              'Badges (Bio, Terroir, Sans gluten, Halal, Kasher, Sucré)',
              'Bouton “Commander” et “Appeler” (sans paiement en ligne si tu veux limiter ce plan)',
            ]}
          />

          <Card
            title="Commande + Paiement (Le plus populaire)"
            subtitle="Sans engagement"
            tagline="Encaissez en ligne et pilotez vos commandes depuis une seule interface."
            cta="Démarrer / Échanger avec un conseiller"
            bullets={[
              'Tout le plan Vitrine',
              'Commande en ligne (panier, options, quantités, notes client)',
              'Paiement Stripe Checkout (one-shot)',
              'Statuts commande en temps réel : reçue → préparation → cuisson → prête',
              'Notifications (nouvelle commande / commande prête)',
              'Gestion de capacité : minutes/pizza + pizzas/heure (affiche un délai estimé)',
              'Créneaux & “pause service” (si rush / rupture)',
              'Historique commandes + stats simples (jour/semaine, best-sellers)',
            ]}
          />

          <Card
            title="Commande + Caisse + TPE"
            subtitle="Sans engagement"
            tagline="Synchronisez la vente sur place et la vente en ligne, sans doublons."
            cta="Échanger avec un conseiller"
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
    </div>
  );
}
