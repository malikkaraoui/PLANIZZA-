import { loadStripe } from '@stripe/stripe-js';

// Clé publishable uniquement (client). Doit être définie dans .env.local
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
