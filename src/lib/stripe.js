import { loadStripe } from '@stripe/stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Initialiser Stripe avec la clé publique depuis l'environnement
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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
    // Charger Stripe
    const stripe = await stripePromise;
    
    if (!stripe) {
      throw new Error('Stripe n\'a pas pu être chargé');
    }

    // Appeler la Cloud Function pour créer une session
    const functions = getFunctions();
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
