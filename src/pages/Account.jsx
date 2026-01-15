import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { signOut, updateProfile, deleteUser, reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { ref, remove, get, set } from 'firebase/database';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { Bike, Store, Trash2 } from 'lucide-react';
import { useAuth } from '../app/providers/AuthProvider';
import { ROUTES } from '../app/routes';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import Card from '../components/ui/Card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { auth, db, storage, isFirebaseConfigured } from '../lib/firebase';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { useLoyaltyPoints } from '../features/users/hooks/useLoyaltyPoints';
import LoyaltyProgressBar from '../components/loyalty/LoyaltyProgressBar';
import { useAutoDismissMessage } from '../hooks/useAutoDismissMessage';

export default function Account() {
  const { isAuthenticated, user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);
  const { flushToStorage, clear: clearCart } = useCart();
  
  // Carte de fidélité
  const { points, currentTier, nextTier, progress, maxTierReached, loading: loyaltyLoading } = useLoyaltyPoints(user?.uid);

  // Profil éditable
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+33');
  
  // Adresse décomposée
  const [streetNumber, setStreetNumber] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('France');
  
  // Préférence livraison
  const [wantsDelivery, setWantsDelivery] = useState(false);
  const [savingDeliveryPref, setSavingDeliveryPref] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Les messages de succès/info doivent disparaître après 5s (les ❌ restent).
  useAutoDismissMessage(message, setMessage, { delayMs: 5000, dismissErrors: false });

  // Suppression de compte
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Charger les données du profil
  useEffect(() => {
    if (!user?.uid || !isAuthenticated) return;

    const loadProfile = async () => {
      try {
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        
        if (snap.exists()) {
          const data = snap.val();
          
          // Charger le nom complet et le décomposer
          const fullName = data.displayName || user.displayName || '';
          const nameParts = fullName.split(' ');
          setFirstName(nameParts[0] || '');
          setLastName(nameParts.slice(1).join(' ') || '');
          
          const fullPhone = data.phoneNumber || '';
          
          // Extraire l'indicatif et le numéro
          if (fullPhone.startsWith('+')) {
            const match = fullPhone.match(/^(\+\d{1,3})\s*(.*)$/);
            if (match) {
              setPhonePrefix(match[1]);
              setPhoneNumber(match[2]);
            } else {
              setPhoneNumber(fullPhone);
            }
          } else {
            setPhoneNumber(fullPhone);
          }
          
          // Charger l'adresse décomposée
          const addr = data.address || {};
          setStreetNumber(addr.streetNumber || '');
          setStreet(addr.street || '');
          setPostalCode(addr.postalCode || '');
          setCity(addr.city || '');
          setCountry(addr.country || 'France');
          
          // Charger préférence livraison
          setWantsDelivery(data.preferences?.wantsDelivery || false);
        }
      } catch (err) {
        console.error('[PLANIZZA] Erreur chargement profil:', err);
      }
    };

    loadProfile();
  }, [user?.uid, user?.displayName, isAuthenticated]);

  // Fonction pour changer la préférence de livraison instantanément
  const handleToggleDeliveryPreference = async (newValue) => {
    if (!user?.uid || savingDeliveryPref) return;

    setSavingDeliveryPref(true);
    setWantsDelivery(newValue);

    try {
      const userRef = ref(db, `users/${user.uid}`);
      const snap = await get(userRef);
      const existingData = snap.exists() ? snap.val() : {};

      await set(userRef, {
        ...existingData,
        preferences: {
          ...existingData.preferences,
          wantsDelivery: newValue
        },
        updatedAt: Date.now()
      });

      console.log('[PLANIZZA] Préférence de livraison mise à jour:', newValue);
    } catch (err) {
      console.error('[PLANIZZA] Erreur mise à jour préférence:', err);
      // Revenir à l'ancienne valeur en cas d'erreur
      setWantsDelivery(!newValue);
    } finally {
      setSavingDeliveryPref(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-gray-600">Chargement…</div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>
        <p className="mt-2 text-sm text-gray-600">Connexion requise.</p>
        <div className="mt-6 flex gap-3">
          <Link to={ROUTES.login} className="underline text-sm">
            Se connecter
          </Link>
          <Link to={ROUTES.register} className="underline text-sm">
            Créer un compte
          </Link>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;

    setSaving(true);
    setMessage('');

    try {
      const fullPhoneNumber = phoneNumber.trim() 
        ? `${phonePrefix} ${phoneNumber.trim()}`
        : '';
      
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

      // ✅ Mettre à jour Firebase Auth
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
      }

      // ✅ Mettre à jour RTDB
      await set(ref(db, `users/${user.uid}`), {
        displayName,
        email: user.email || '',
        photoURL: user.photoURL || '',
        phoneNumber: fullPhoneNumber,
        address: {
          streetNumber: streetNumber.trim(),
          street: street.trim(),
          postalCode: postalCode.trim(),
          city: city.trim(),
          country: country.trim()
        },
        preferences: {
          wantsDelivery: wantsDelivery
        },
        updatedAt: Date.now()
      });

      setMessage('✅ Profil sauvegardé avec succès !');
      setIsEditing(false);

      // Mettre à jour l'UI sans recharger toute l'app
      await refreshUser?.();
      
      console.log('[PLANIZZA] Profil utilisateur mis à jour');
    } catch (err) {
      console.error('[PLANIZZA] Erreur sauvegarde profil:', err);
      setMessage('❌ Erreur lors de la sauvegarde. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    setSignOutError(null);

    if (!isFirebaseConfigured || !auth) {
      setSignOutError("Firebase n'est pas configuré sur cet environnement.");
      return;
    }

    setSigningOut(true);
    try {
      flushToStorage?.();

      if (isFirebaseConfigured && db && user?.uid) {
        try {
          await remove(ref(db, `carts/${user.uid}/active`));
        } catch (e) {
          console.warn('[PLANIZZA] Impossible de supprimer le panier RTDB avant logout:', e);
        }
      }

      await signOut(auth);
      navigate(ROUTES.explore, { replace: true });
    } catch (err) {
      console.warn('[PLANIZZA] signOut error:', err);
      setSignOutError("Impossible de se déconnecter. Réessayez.");
    } finally {
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') {
      alert('Veuillez taper "SUPPRIMER" pour confirmer');
      return;
    }

    setDeleting(true);
    try {
      const uid = user.uid;

      // 0. Ré-authentification si nécessaire (Firebase exige une connexion récente)
      try {
        await deleteUser(auth.currentUser);
      } catch (err) {
        if (err.code === 'auth/requires-recent-login') {
          // Forcer la ré-authentification
          try {
            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(auth.currentUser, provider);
            // Réessayer la suppression
            await deleteUser(auth.currentUser);
          } catch (reauthErr) {
            console.error('Erreur ré-authentification:', reauthErr);
            alert('Vous devez vous reconnecter pour supprimer votre compte. Veuillez vous déconnecter puis vous reconnecter.');
            setDeleting(false);
            setShowDeleteConfirm(false);
            return;
          }
        } else {
          throw err;
        }
      }

      // 1. Supprimer la photo de profil dans Storage si elle existe
      if (user.photoURL && user.photoURL.includes('firebase')) {
        try {
          const photoRef = storageRef(storage, `users/${uid}/profile.jpg`);
          await deleteObject(photoRef);
        } catch (err) {
          console.warn('Erreur suppression photo profil:', err);
        }
      }

      // 2. Commandes: on ne supprime pas côté client.
      // En prod, les commandes doivent rester traçables (audit/comptabilité).
      // Si besoin d'une suppression/anonymisation, prévoir une Cloud Function admin.

      // 3. Supprimer les données utilisateur dans RTDB
      await remove(ref(db, `users/${uid}`));
      await remove(ref(db, `carts/${uid}`));
      
      // Supprimer aussi de pizzaiolos si c'est un pizzaiolo
      try {
        await remove(ref(db, `pizzaiolos/${uid}`));
      } catch {
        // Pas grave si ça n'existe pas
      }

      // 4. Le compte Auth est déjà supprimé au début (avec ré-auth si nécessaire)

      // 5. Vider le localStorage et sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      // Vider aussi l'état en mémoire du panier (sinon il peut rester affiché jusqu'au prochain mount)
      clearCart?.();

      // 6. Rediriger sans rechargement complet
      navigate(ROUTES.explore, { replace: true });
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setDeleting(false);
    } catch (err) {
      console.error('Erreur suppression compte:', err);
      alert('Erreur lors de la suppression du compte. Veuillez réessayer ou nous contacter.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-black text-gray-900 mb-8">Mon Profil</h1>

      {/* Compte Google */}
      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Compte Google</h2>
            <p className="text-sm text-gray-600 mt-1">Informations de connexion</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-white/40 shadow-xl">
            <AvatarImage src={user?.photoURL} alt={user?.displayName || 'User'} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-lg">{user?.displayName || 'Utilisateur'}</p>
            <p className="text-sm text-gray-600">{user?.email}</p>
          </div>
        </div>

        {/* Carte de fidélité */}
        {!loyaltyLoading && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <LoyaltyProgressBar
              points={points}
              currentTier={currentTier}
              nextTier={nextTier}
              progress={progress}
              maxTierReached={maxTierReached}
            />
          </div>
        )}
      </Card>

      {/* Informations personnelles */}
      {!isEditing ? (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Informations personnelles</h2>
              <p className="text-sm text-gray-600 mt-1">Vos coordonnées</p>
            </div>
            <Button onClick={() => setIsEditing(true)} variant="outline">
              ✏️ Modifier
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">� Nom complet</p>
              <p className="text-gray-700 mt-1">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Non renseigné'}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-900">�📱 Téléphone</p>
              <p className="text-gray-700 mt-1">
                {phonePrefix && phoneNumber ? `${phonePrefix} ${phoneNumber}` : 'Non renseigné'}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-900">📍 Adresse</p>
              {streetNumber || street || postalCode || city ? (
                <div className="text-gray-700 mt-1">
                  {streetNumber && street && <p>{streetNumber} {street}</p>}
                  {!streetNumber && street && <p>{street}</p>}
                  {(postalCode || city) && (
                    <p>{postalCode} {city}</p>
                  )}
                  {country && <p>{country}</p>}
                </div>
              ) : (
                <p className="text-gray-700 mt-1">Non renseignée</p>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">🚚 Méthode de récupération par défaut</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Retrait au camion */}
                <button
                  onClick={() => handleToggleDeliveryPreference(false)}
                  disabled={savingDeliveryPref}
                  className={`group relative overflow-hidden rounded-[28px] p-6 transition-all duration-300 ${
                    !wantsDelivery
                      ? 'bg-primary text-white shadow-xl shadow-primary/30'
                      : 'glass-premium border-white/20 opacity-50 hover:opacity-100 hover:scale-[1.02]'
                  } ${savingDeliveryPref ? 'cursor-wait' : 'cursor-pointer'}`}
                >
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`p-4 rounded-2xl transition-all ${
                      !wantsDelivery 
                        ? 'bg-white/20' 
                        : 'bg-primary/10'
                    }`}>
                      <Store className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="font-black text-lg tracking-tight">Retrait au camion</div>
                      <div className={`text-sm mt-1 ${
                        !wantsDelivery 
                          ? 'text-white/80' 
                          : 'text-muted-foreground'
                      }`}>
                        Gratuit • Prêt en 15-20 min
                      </div>
                    </div>
                    {!wantsDelivery && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                </button>

                {/* Livraison à domicile */}
                <button
                  onClick={() => handleToggleDeliveryPreference(true)}
                  disabled={savingDeliveryPref}
                  className={`group relative overflow-hidden rounded-[28px] p-6 transition-all duration-300 ${
                    wantsDelivery
                      ? 'bg-primary text-white shadow-xl shadow-primary/30'
                      : 'glass-premium border-white/20 opacity-50 hover:opacity-100 hover:scale-[1.02]'
                  } ${savingDeliveryPref ? 'cursor-wait' : 'cursor-pointer'}`}
                >
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`p-4 rounded-2xl transition-all ${
                      wantsDelivery 
                        ? 'bg-white/20' 
                        : 'bg-primary/10'
                    }`}>
                      <Bike className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="font-black text-lg tracking-tight">Livraison à domicile</div>
                      <div className={`text-sm mt-1 ${
                        wantsDelivery 
                          ? 'text-white/80' 
                          : 'text-muted-foreground'
                      }`}>
                        + 3,50€ • 30-40 min
                      </div>
                    </div>
                    {wantsDelivery && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Modifier mes informations</h2>
              <p className="text-sm text-gray-600 mt-1">Mettez à jour vos coordonnées</p>
            </div>
            <Button onClick={() => setIsEditing(false)} variant="outline">
              Annuler
            </Button>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Prénom et Nom */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">👤 Prénom</label>
                <Input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Prénom"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">👤 Nom</label>
                <Input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Nom"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📱 Numéro de téléphone</label>
              <div className="flex gap-2">
                <select 
                  value={phonePrefix}
                  onChange={(e) => setPhonePrefix(e.target.value)}
                  className="w-24 rounded-md border border-gray-300 px-2 py-2 text-sm bg-white"
                >
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+32">🇧🇪 +32</option>
                  <option value="+41">🇨🇭 +41</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+34">🇪🇸 +34</option>
                  <option value="+39">🇮🇹 +39</option>
                </select>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="6 12 34 56 78"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">📍 Adresse</label>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    type="text"
                    value={streetNumber}
                    onChange={(e) => setStreetNumber(e.target.value)}
                    placeholder="N°"
                    className="col-span-1"
                  />
                  <Input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Nom de rue"
                    className="col-span-2"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Code postal"
                    className="col-span-1"
                  />
                  <Input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ville"
                    className="col-span-2"
                  />
                </div>

                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="France">🇫🇷 France</option>
                  <option value="Belgique">🇧🇪 Belgique</option>
                  <option value="Suisse">🇨🇭 Suisse</option>
                  <option value="Luxembourg">🇱🇺 Luxembourg</option>
                  <option value="Canada">🇨🇦 Canada</option>
                  <option value="États-Unis">🇺🇸 États-Unis</option>
                </select>
              </div>
            </div>

            {/* Préférence de livraison */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">🚚 Méthode de récupération par défaut</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Retrait au camion */}
                <button
                  type="button"
                  onClick={() => setWantsDelivery(false)}
                  className={`group relative overflow-hidden rounded-[28px] p-6 transition-all duration-300 ${
                    !wantsDelivery
                      ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                      : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`p-4 rounded-2xl transition-all ${
                      !wantsDelivery 
                        ? 'bg-white/20' 
                        : 'bg-primary/10 group-hover:bg-primary/20'
                    }`}>
                      <Store className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="font-black text-lg tracking-tight">Retrait au camion</div>
                      <div className={`text-sm mt-1 ${
                        !wantsDelivery 
                          ? 'text-white/80' 
                          : 'text-muted-foreground'
                      }`}>
                        Gratuit • Prêt en 15-20 min
                      </div>
                    </div>
                    {!wantsDelivery && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                </button>

                {/* Livraison à domicile */}
                <button
                  type="button"
                  onClick={() => setWantsDelivery(true)}
                  className={`group relative overflow-hidden rounded-[28px] p-6 transition-all duration-300 ${
                    wantsDelivery
                      ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                      : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`p-4 rounded-2xl transition-all ${
                      wantsDelivery 
                        ? 'bg-white/20' 
                        : 'bg-primary/10 group-hover:bg-primary/20'
                    }`}>
                      <Bike className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="font-black text-lg tracking-tight">Livraison à domicile</div>
                      <div className={`text-sm mt-1 ${
                        wantsDelivery 
                          ? 'text-white/80' 
                          : 'text-muted-foreground'
                      }`}>
                        + 3,50€ • 30-40 min
                      </div>
                    </div>
                    {wantsDelivery && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-lg ${message.includes('✅') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                {message}
              </div>
            )}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Sauvegarde en cours...' : 'Enregistrer mes informations'}
            </Button>
          </form>
        </Card>
      )}

      {/* Actions */}
      <Card className="p-6 mt-6">
        <div className="space-y-4">
          <Link to={ROUTES.myOrders}>
            <Button variant="outline" className="w-full">
              📦 Mes commandes
            </Button>
          </Link>

          <Button 
            variant="outline" 
            onClick={onSignOut} 
            disabled={signingOut}
            className="w-full"
          >
            {signingOut ? 'Déconnexion…' : '🚪 Se déconnecter'}
          </Button>
          {signOutError && <p className="text-sm text-red-600">{signOutError}</p>}

          <Button 
            variant="destructive" 
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full mt-4"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer mon compte
          </Button>
        </div>
      </Card>

      {/* Modal de confirmation suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-black mb-2">Supprimer mon compte</h2>
              <p className="text-muted-foreground text-sm">
                Cette action est <strong>irréversible</strong>. Toutes vos données seront définitivement supprimées :
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>Informations personnelles (nom, prénom, téléphone)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>Photo de profil</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>Toutes vos commandes (en cours, payées, archivées)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>Votre panier</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>Points de fidélité</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-2">
                Pour confirmer, tapez <span className="text-red-600">SUPPRIMER</span>
              </label>
              <Input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Tapez SUPPRIMER"
                className="text-center font-bold"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                disabled={deleting}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'SUPPRIMER'}
                className="flex-1"
              >
                {deleting ? 'Suppression...' : 'Supprimer définitivement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
