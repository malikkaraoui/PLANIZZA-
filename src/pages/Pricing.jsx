import { useState } from 'react';
import { CreditCard, Check, X } from 'lucide-react';

export default function Pricing() {
  const [loading, setLoading] = useState(null);

  // Exemples de plans (à adapter selon vos produits Stripe)
  const plans = [
    {
      id: 'basic',
      name: 'Basique',
      price: '9.99',
      currency: '€',
      period: '/mois',
      stripePriceId: 'price_XXXXX', // TODO: Remplacer par votre vrai Price ID Stripe
      features: [
        { text: 'Jusqu\'à 10 projets', included: true },
        { text: 'Stockage 5 GB', included: true },
        { text: 'Support par email', included: true },
        { text: 'Analyses avancées', included: false },
        { text: 'API Access', included: false },
      ],
    },
    {
      id: 'pro',
      name: 'Professionnel',
      price: '29.99',
      currency: '€',
      period: '/mois',
      stripePriceId: 'price_YYYYY', // TODO: Remplacer par votre vrai Price ID Stripe
      popular: true,
      features: [
        { text: 'Projets illimités', included: true },
        { text: 'Stockage 100 GB', included: true },
        { text: 'Support prioritaire', included: true },
        { text: 'Analyses avancées', included: true },
        { text: 'API Access', included: false },
      ],
    },
    {
      id: 'enterprise',
      name: 'Entreprise',
      price: '99.99',
      currency: '€',
      period: '/mois',
      stripePriceId: 'price_ZZZZZ', // TODO: Remplacer par votre vrai Price ID Stripe
      features: [
        { text: 'Projets illimités', included: true },
        { text: 'Stockage illimité', included: true },
        { text: 'Support 24/7', included: true },
        { text: 'Analyses avancées', included: true },
        { text: 'API Access', included: true },
      ],
    },
  ];

  const handleSubscribe = async (plan) => {
    setLoading(plan.id);
    try {
      // MVP PLANIZZA: le paiement se fait via commande (RTDB) -> Cloud Function createCheckoutSession(orderId)
      // Cette page "Pricing" reste une démo UI et ne déclenche pas de paiement.
      alert(
        "MVP: les abonnements ne sont pas activés. Le paiement se fait lors d'une commande (panier) sur la fiche camion."
      );
    } catch (error) {
      console.error('Erreur lors du checkout:', error);
      alert('Erreur lors du paiement. Veuillez réessayer.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Des tarifs simples et transparents pour tous vos besoins
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg p-8 flex flex-col ${
                plan.popular ? 'ring-2 ring-blue-600 scale-105' : ''
              }`}
            >
              {/* Badge Popular */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Populaire
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-extrabold text-gray-900">
                    {plan.price}
                  </span>
                  <span className="text-xl text-gray-600 ml-1">
                    {plan.currency}
                  </span>
                  <span className="text-gray-500 ml-1">{plan.period}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8 flex-grow">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300 mr-3 mt-0.5 flex-shrink-0" />
                    )}
                    <span
                      className={
                        feature.included ? 'text-gray-700' : 'text-gray-400'
                      }
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={loading !== null}
                className={`w-full py-3 px-6 rounded-lg font-semibold flex items-center justify-center transition-all ${
                  plan.popular
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === plan.id ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Chargement...
                  </span>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    S'abonner
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Info Footer */}
        <div className="mt-16 text-center text-gray-600">
          <p className="text-sm">
            💳 Paiement sécurisé par Stripe • 🔒 Annulation à tout moment
          </p>
          <p className="text-xs mt-2">
            En mode test : utilisez la carte{' '}
            <code className="bg-gray-200 px-2 py-1 rounded">
              4242 4242 4242 4242
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
