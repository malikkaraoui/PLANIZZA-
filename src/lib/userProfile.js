import { get, ref, serverTimestamp, set, update } from 'firebase/database';
import { db, isFirebaseConfigured } from './firebase';

/**
 * DÉPRÉCIÉ - Ne plus utiliser cette fonction.
 * Les profils client et pizzaiolo sont maintenant créés explicitement
 * via useClientProfile.createClientProfile() ou usePizzaioloProfile.createPizzaioloProfile()
 */
export async function upsertUserProfile(firebaseUser) {
  // Ne fait plus rien - on ne crée plus automatiquement de profil
  console.warn('[DEPRECATED] upsertUserProfile ne crée plus de profil automatiquement');
  return;
}
