import { loadStripe } from '@stripe/stripe-js';
import { auth, functions, isFirebaseConfigured } from './firebase';

const FUNCTIONS_BASE =
  import.meta.env.VITE_FUNCTIONS_ORIGIN ||
  `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

// Initialiser Stripe avec la clé publique depuis l'environnement
// (ne pas planter si la clé n'est pas encore renseignée en DEV)
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : Promise.resolve(null);

/**
 * Créer une session Stripe Checkout et rediriger l'utilisateur
 * 
 * @param {Object} options - Options pour la session Checkout
 * @param {string} options.orderId - ID de commande RTDB (orders/{orderId})
 * @returns {Promise<void>}
 * 
 * @example
 * import { createCheckoutSession } from '@/lib/stripe';
 * 
 * const handleCheckout = async () => {
 *   try {
 *     await createCheckoutSession({
 *       orderId: 'order_abc123',
 *     });
 *   } catch (error) {
 *     console.error('Erreur lors du checkout:', error);
 *     alert('Erreur lors du paiement. Veuillez réessayer.');
 *   }
 * };
 */
export async function createCheckoutSession({ orderId }) {
  try {
    if (!isFirebaseConfigured || !functions) {
      throw new Error(
        'Firebase Functions n\'est pas configuré. Configurez .env.local (Firebase) et démarrez les émulateurs ou déployez les functions.'
      );
    }

    if (!orderId) {
      throw new Error("Paramètre requis: orderId");
    }

    // Charger Stripe
    const stripe = await stripePromise;
    
    if (!stripe) {
      throw new Error(
        "Stripe n'est pas configuré. Renseignez VITE_STRIPE_PUBLISHABLE_KEY dans .env.local"
      );
    }

    // Appeler l'endpoint HTTP v2 (onRequest) avec Auth Bearer
    const token = await auth?.currentUser?.getIdToken?.();
    if (!token) {
      throw new Error('Vous devez être connecté pour payer.');
    }

    const res = await fetch(`${FUNCTIONS_BASE}/createCheckoutSession`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`createCheckoutSession HTTP ${res.status} ${msg}`);
    }

    const data = await res.json();

    // Rediriger vers Stripe Checkout via URL (méthode moderne)
    if (data?.url) {
      window.location.assign(data.url);
      return;
    }

    throw new Error("Réponse inattendue de createCheckoutSession");
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
 * function CheckoutButton({ orderId }) {
 *   const [loading, setLoading] = useState(false);
 * 
 *   const handleBuyNow = async () => {
 *     setLoading(true);
 *     try {
 *       await createCheckoutSession({
 *         orderId,
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
