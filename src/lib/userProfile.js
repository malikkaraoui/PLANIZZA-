import { get, ref, serverTimestamp, set, update } from 'firebase/database';
import { db, isFirebaseConfigured } from './firebase';

/**
 * Nettoyer les données de session guest obsolètes du localStorage
 * À appeler après un login réussi avec un compte non-anonyme
 */
export function cleanupGuestSession() {
  try {
    // Supprimer l'UID guest s'il existe
    const guestUserId = localStorage.getItem('planizza:guestUserId');
    if (guestUserId) {
      localStorage.removeItem('planizza:guestUserId');
      console.log('[PLANIZZA] Session guest nettoyée:', guestUserId);
    }
  } catch (err) {
    console.warn('[PLANIZZA] Erreur nettoyage session guest:', err);
  }
}

/**
 * DÉPRÉCIÉ - Ne plus utiliser cette fonction.
 * Les profils client et pizzaiolo sont maintenant créés explicitement
 * via useClientProfile.createClientProfile() ou usePizzaioloProfile.createPizzaioloProfile()
 */
export async function upsertUserProfile(firebaseUser) {
  // Ne fait plus rien - on ne crée plus automatiquement de profil
  console.warn('[DEPRECATED] upsertUserProfile ne crée plus de profil automatiquement');

  // Nettoyer les sessions guest si l'utilisateur n'est pas anonyme
  if (firebaseUser && !firebaseUser.isAnonymous) {
    cleanupGuestSession();
  }

  return;
}
