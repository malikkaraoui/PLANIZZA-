import { get, ref, serverTimestamp, set, update } from 'firebase/database';
import { db, isFirebaseConfigured } from './firebase';

/**
 * Crée/MàJ le profil utilisateur dans RTDB.
 *
 * Stockage par UID (clé sûre côté règles), tout en conservant l'email comme identifiant unique métier.
 * Chemin: /users/{uid}
 */
export async function upsertUserProfile(firebaseUser) {
  if (!isFirebaseConfigured || !db) return;
  if (!firebaseUser?.uid) return;

  const userRef = ref(db, `users/${firebaseUser.uid}`);

  const payload = {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? null,
    displayName: firebaseUser.displayName ?? null,
    photoURL: firebaseUser.photoURL ?? null,
    providerId: firebaseUser.providerData?.[0]?.providerId ?? null,
    updatedAt: serverTimestamp(),
  };

  const snap = await get(userRef);

  if (!snap.exists()) {
    await set(userRef, {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return;
  }

  // Ne pas écraser createdAt si déjà présent
  await update(userRef, payload);
}
