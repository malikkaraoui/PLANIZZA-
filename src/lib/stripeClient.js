import { loadStripe } from '@stripe/stripe-js';

// Clé publishable uniquement (client). Doit être définie dans .env.local
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export async function redirectToCheckout({ sessionId }) {
  if (!stripePromise) {
    throw new Error('Stripe non configuré: VITE_STRIPE_PUBLISHABLE_KEY manquante');
  }

  const stripe = await stripePromise;
  if (!stripe) throw new Error('Stripe n\'a pas pu être initialisé');

  const { error } = await stripe.redirectToCheckout({ sessionId });
  if (error) throw error;
}
