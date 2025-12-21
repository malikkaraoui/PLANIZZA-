import { loadStripe } from '@stripe/stripe-js';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// Initialiser Stripe avec la clé publique depuis l'environnement
// (ne pas planter si la clé n'est pas encore renseignée en DEV)
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : Promise.resolve(null);

/**
 * Créer une session Stripe Checkout et rediriger l'utilisateur
 * 
 * @param {Object} options - Options pour la session Checkout
 * @param {string} options.priceId - ID du prix Stripe (ex: price_xxxxx)
 * @param {number} options.quantity - Quantité à acheter (défaut: 1)
 * @param {string} options.successUrl - URL de redirection en cas de succès
 * @param {string} options.cancelUrl - URL de redirection en cas d'annulation
 * @returns {Promise<void>}
 * 
 * @example
 * import { createCheckoutSession } from '@/lib/stripe';
 * 
 * const handleCheckout = async () => {
 *   try {
 *     await createCheckoutSession({
 *       priceId: 'price_1234567890',
 *       quantity: 1,
 *       successUrl: `${window.location.origin}/success`,
 *       cancelUrl: `${window.location.origin}/cancel`
 *     });
 *   } catch (error) {
 *     console.error('Erreur lors du checkout:', error);
 *     alert('Erreur lors du paiement. Veuillez réessayer.');
 *   }
 * };
 */
export async function createCheckoutSession({ 
  priceId, 
  quantity = 1, 
  successUrl, 
  cancelUrl 
}) {
  try {
    if (!functions) {
      throw new Error(
        'Firebase Functions n\'est pas configuré. Configurez .env.local (Firebase) et démarrez les émulateurs ou déployez les functions.'
      );
    }

    // Charger Stripe
    const stripe = await stripePromise;
    
    if (!stripe) {
      throw new Error(
        "Stripe n'est pas configuré. Renseignez VITE_STRIPE_PUBLISHABLE_KEY dans .env.local"
      );
    }

    // Appeler la Cloud Function pour créer une session
    const createSession = httpsCallable(functions, 'createCheckoutSession');
    
    const { data } = await createSession({
      priceId,
      quantity,
      successUrl: successUrl || `${window.location.origin}/success`,
      cancelUrl: cancelUrl || `${window.location.origin}/cancel`,
    });

    // Rediriger vers Stripe Checkout
    const { error } = await stripe.redirectToCheckout({
      sessionId: data.sessionId,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Erreur lors de la création de la session Stripe:', error);
    throw error;
  }
}

/**
 * Exemple d'utilisation dans un composant React
 * 
 * ```jsx
 * import { createCheckoutSession } from '@/lib/stripe';
 * 
 * function ProductCard({ product }) {
 *   const [loading, setLoading] = useState(false);
 * 
 *   const handleBuyNow = async () => {
 *     setLoading(true);
 *     try {
 *       await createCheckoutSession({
 *         priceId: product.stripePriceId,
 *         quantity: 1,
 *       });
 *     } catch (error) {
 *       alert('Erreur lors du paiement');
 *     } finally {
 *       setLoading(false);
 *     }
 *   };
 * 
 *   return (
 *     <button 
 *       onClick={handleBuyNow} 
 *       disabled={loading}
 *     >
 *       {loading ? 'Chargement...' : 'Acheter maintenant'}
 *     </button>
 *   );
 * }
 * ```
 */

export default stripePromise;
