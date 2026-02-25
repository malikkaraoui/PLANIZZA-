import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { signOut, updateProfile, deleteUser, reauthenticateWithPopup, GoogleAuthProvider, linkWithCredential, EmailAuthProvider } from 'firebase/auth';
import { ref, remove, get, set } from 'firebase/database';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { AlertCircle, Bike, Store, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '../app/providers/AuthProvider';
import { ROUTES } from '../app/routes';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import Card from '../components/ui/Card';
import BackButton from '../components/ui/BackButton';
import PhoneInputWithPrefix from '../components/ui/PhoneInputWithPrefix';
import AddressAutocomplete from '../components/ui/AddressAutocomplete';
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

  // Adresse unifiée (même format que Dashboard)
  const [address, setAddress] = useState({
    streetNumber: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'France'
  });

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

  // Gestion upgrade compte guest
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  // Détection si l'utilisateur est guest
  const isGuest = user?.isAnonymous || false;

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
          
          // Charger le téléphone (format +336... ou +337...)
          const fullPhone = data.phoneNumber || '';
          if (fullPhone.startsWith('+33')) {
            const digits = fullPhone.slice(3); // Enlever +33
            setPhoneNumber(digits);
          } else {
            setPhoneNumber('');
          }

          // Charger l'adresse
          const addr = data.address || {};
          setAddress({
            streetNumber: addr.streetNumber || '',
            street: addr.street || '',
            postalCode: addr.postalCode || '',
            city: addr.city || '',
            country: addr.country || 'France'
          });
          
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
      const fullPhoneNumber = phoneNumber ? `+33${phoneNumber.replace(/\s/g, '')}` : '';

      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

      // Si guest et qu'il remplit des informations importantes, proposer l'upgrade
      if (isGuest && (firstName.trim() || lastName.trim() || phoneNumber.trim() || address.street.trim())) {
        // Sauvegarder temporairement les données
        await set(ref(db, `users/${user.uid}`), {
          displayName,
          email: user.email || '',
          photoURL: user.photoURL || '',
          phoneNumber: fullPhoneNumber,
          address: {
            streetNumber: address.streetNumber.trim(),
            street: address.street.trim(),
            postalCode: address.postalCode.trim(),
            city: address.city.trim(),
            country: address.country.trim()
          },
          preferences: {
            wantsDelivery: wantsDelivery
          },
          updatedAt: Date.now()
        });

        // Afficher le prompt d'upgrade
        setShowEmailPrompt(true);
        setSaving(false);
        return;
      }

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
          streetNumber: address.streetNumber.trim(),
          street: address.street.trim(),
          postalCode: address.postalCode.trim(),
          city: address.city.trim(),
          country: address.country.trim()
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

  const handleUpgradeAccount = async () => {
    if (!upgradeEmail.trim() || !upgradePassword.trim()) {
      setMessage('❌ Veuillez renseigner un email et un mot de passe.');
      return;
    }

    setUpgrading(true);
    setMessage('');

    try {
      if (!auth.currentUser || !isGuest) {
        setMessage('❌ Erreur: compte non valide pour upgrade.');
        return;
      }

      // Upgrade du compte anonyme avec email/password
      const credential = EmailAuthProvider.credential(upgradeEmail.trim(), upgradePassword.trim());
      await linkWithCredential(auth.currentUser, credential);

      console.log('[PLANIZZA] Compte anonyme upgradé avec succès!', auth.currentUser.uid);

      // Mettre à jour l'email dans RTDB
      await set(ref(db, `users/${user.uid}/email`), upgradeEmail.trim());

      setMessage('✅ Compte créé avec succès! Vous pouvez maintenant vous connecter avec votre email.');
      setShowEmailPrompt(false);
      setIsEditing(false);

      // Rafraîchir l'utilisateur
      await refreshUser?.();
    } catch (err) {
      console.error('[PLANIZZA] Erreur upgrade compte:', err);
      if (err.code === 'auth/email-already-in-use') {
        setMessage('❌ Cet email est déjà utilisé. Veuillez vous connecter.');
      } else if (err.code === 'auth/credential-already-in-use') {
        setMessage('❌ Cet email est déjà lié à un autre compte.');
      } else {
        setMessage('❌ Erreur lors de la création du compte. Réessayez.');
      }
    } finally {
      setUpgrading(false);
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
    <div className="relative isolate mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-8">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 -z-10 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />

      <BackButton className="mb-4" />

      {/* Hero Section - Avatar + Nom */}
      <div className="text-center space-y-6">
        <div className="flex flex-col items-center gap-6">
          <Avatar className="h-28 w-28 ring-4 ring-primary/20 ring-offset-4 shadow-2xl">
            <AvatarImage src={user?.photoURL} alt={user?.displayName || 'User'} />
            <AvatarFallback className="bg-linear-to-br from-primary to-purple-500 text-white font-black text-3xl">
              {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-premium-gradient">
              Mon Profil
            </h1>
            {isGuest && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-900">Session temporaire</span>
              </div>
            )}
          </div>
        </div>

        {/* Carte de fidélité */}
        {!loyaltyLoading && !isGuest && (
          <div className="max-w-lg mx-auto">
            <LoyaltyProgressBar
              points={points}
              currentTier={currentTier}
              nextTier={nextTier}
              progress={progress}
              maxTierReached={maxTierReached}
            />
          </div>
        )}
      </div>

      {/* Bannière session éphémère pour les guests */}
      {isGuest && (
        <Card className="glass-premium glass-glossy border-amber-200/50 p-6 bg-linear-to-br from-amber-50 to-amber-100/50">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10">
              <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-amber-900 mb-2">⏳ Session éphémère</h2>
              <p className="text-sm text-amber-800 mb-4">
                Pour des raisons de sécurité et de traçabilité du paiement, une session temporaire a été créée automatiquement.
                <strong> Toutes les informations seront supprimées dans 7 jours.</strong>
              </p>
              <Link to={ROUTES.register}>
                <Button className="w-full sm:w-auto rounded-2xl" variant="default">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Créer mon compte
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Compte - Informations basiques */}
      <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-4xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">{isGuest ? 'Session temporaire' : 'Compte Google'}</h2>
            <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Informations personnelles */}
      {!isEditing ? (
        <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-4xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Informations personnelles</h2>
              <p className="text-sm text-muted-foreground mt-1">Vos coordonnées</p>
            </div>
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="rounded-2xl">
              ✏️ Modifier
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">👤 Nom complet</p>
              <p className="text-gray-900 font-semibold text-lg">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Non renseigné'}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📱 Téléphone</p>
              <p className="text-gray-900 font-semibold text-lg">
                {phoneNumber ? `+33 ${phoneNumber}` : 'Non renseigné'}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📍 Adresse</p>
              {address.streetNumber || address.street || address.postalCode || address.city ? (
                <div className="text-gray-900 space-y-0.5">
                  {address.streetNumber && address.street && <p className="font-semibold text-lg">{address.streetNumber} {address.street}</p>}
                  {!address.streetNumber && address.street && <p className="font-semibold text-lg">{address.street}</p>}
                  {(address.postalCode || address.city) && (
                    <p className="text-muted-foreground">{address.postalCode} {address.city}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-900 italic">Non renseignée</p>
              )}
              <p className="mt-2 text-xs text-amber-600 font-medium">
                La livraison à domicile arrive bientôt&nbsp;! Renseignez votre adresse dès maintenant.
              </p>
            </div>

            {/*
              🚚 SECTION MÉTHODE DE RÉCUPÉRATION - DÉSACTIVÉE TEMPORAIREMENT
              À réactiver quand la livraison Uber Eats sera implémentée

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">🚚 Méthode de récupération préférée</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => handleToggleDeliveryPreference(false)} disabled={savingDeliveryPref} className={...}>
                    Retrait au camion
                  </button>
                  <button onClick={() => handleToggleDeliveryPreference(true)} disabled={savingDeliveryPref} className={...}>
                    Livraison à domicile
                  </button>
                </div>
              </div>
            */}
          </div>
        </Card>
      ) : (
        <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-4xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Modifier mes informations</h2>
              <p className="text-sm text-muted-foreground mt-1">Mettez à jour vos coordonnées</p>
            </div>
            <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" className="rounded-2xl">
              Annuler
            </Button>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Prénom et Nom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">👤 Prénom</label>
                <Input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Prénom"
                  className="rounded-2xl"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">👤 Nom</label>
                <Input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Nom"
                  className="rounded-2xl"
                  required
                />
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📱 Numéro de téléphone</label>
              <PhoneInputWithPrefix
                value={phoneNumber}
                onChange={setPhoneNumber}
                placeholder="6 51 21 47 82"
              />
            </div>

            {/* Adresse */}
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📍 Adresse</label>
              <AddressAutocomplete
                address={address}
                onAddressChange={setAddress}
              />
              <p className="mt-2 text-xs text-amber-600 font-medium">
                La livraison à domicile arrive bientôt&nbsp;! Renseignez votre adresse dès maintenant.
              </p>
            </div>

            {/*
              🚚 SECTION MÉTHODE DE RÉCUPÉRATION EN MODE ÉDITION - DÉSACTIVÉE TEMPORAIREMENT
              À réactiver quand la livraison Uber Eats sera implémentée

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">🚚 Méthode de récupération par défaut</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button type="button" onClick={() => setWantsDelivery(false)} className={...}>
                    Retrait au camion
                  </button>
                  <button type="button" onClick={() => setWantsDelivery(true)} className={...}>
                    Livraison à domicile
                  </button>
                </div>
              </div>
            */}

            {message && (
              <div className={`p-4 rounded-2xl font-medium ${
                message.includes('✅') 
                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-700 border border-red-500/20'
              }`}>
                {message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1 rounded-2xl font-bold">
                {saving ? 'Sauvegarde...' : '💾 Enregistrer'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Actions rapides */}
      <div className="grid gap-4">
        {/* Se déconnecter ou Créer compte */}
        {!isGuest ? (
          <button onClick={onSignOut} disabled={signingOut} className="group text-left">
            <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 h-full">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                  <span className="text-3xl">🚪</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black tracking-tight">{signingOut ? 'Déconnexion...' : 'Se déconnecter'}</h3>
                  <p className="text-xs text-muted-foreground">Quitter la session</p>
                </div>
              </div>
            </Card>
          </button>
        ) : (
          <Link to={ROUTES.register} className="group">
            <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 h-full">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                  <UserPlus className="h-7 w-7 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black tracking-tight">Créer mon compte</h3>
                  <p className="text-xs text-muted-foreground">Sauvegarder mes données</p>
                </div>
              </div>
            </Card>
          </Link>
        )}
        
        {/* Supprimer compte - très discret */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-muted-foreground/50 hover:text-red-600 transition-colors underline underline-offset-2"
          >
            Supprimer mon compte
          </button>
        </div>
      </div>

      {signOutError && (
        <Card className="glass-premium border-red-200/50 p-4 rounded-2xl bg-red-50">
          <p className="text-sm text-red-800 font-medium">{signOutError}</p>
        </Card>
      )}

      {/* Modal upgrade compte pour guest */}
      {showEmailPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="glass-premium glass-glossy border-white/30 rounded-4xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-linear-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                <UserPlus className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-black tracking-tight mb-2">Créer votre compte</h2>
              <p className="text-muted-foreground text-sm">
                Vous avez renseigné des informations personnelles. Pour les sauvegarder et ne pas les perdre, créez un compte avec votre email.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📧 Email</label>
                <Input
                  type="email"
                  value={upgradeEmail}
                  onChange={(e) => setUpgradeEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="rounded-2xl"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🔒 Mot de passe</label>
                <Input
                  type="password"
                  value={upgradePassword}
                  onChange={(e) => setUpgradePassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-2xl"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum 6 caractères</p>
              </div>
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded-2xl text-sm font-medium ${
                message.includes('✅') 
                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-700 border border-red-500/20'
              }`}>
                {message}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmailPrompt(false);
                  setUpgradeEmail('');
                  setUpgradePassword('');
                  setIsEditing(false);
                }}
                disabled={upgrading}
                className="flex-1 rounded-2xl"
              >
                Plus tard
              </Button>
              <Button
                variant="default"
                onClick={handleUpgradeAccount}
                disabled={upgrading || !upgradeEmail.trim() || !upgradePassword.trim()}
                className="flex-1 rounded-2xl font-bold"
              >
                {upgrading ? 'Création...' : '✨ Créer mon compte'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="glass-premium glass-glossy border-red-500/30 rounded-4xl p-8 max-w-md w-full shadow-2xl shadow-red-500/20 animate-in zoom-in-95 duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-linear-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/30">
                <Trash2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-black tracking-tight mb-2">Supprimer mon compte</h2>
              <p className="text-muted-foreground text-sm">
                Cette action est <strong className="text-red-600">irréversible</strong>. Toutes vos données seront définitivement supprimées :
              </p>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 space-y-2 text-sm">
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
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Pour confirmer, tapez <span className="text-red-600 font-black">SUPPRIMER</span>
              </label>
              <Input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Tapez SUPPRIMER"
                className="text-center font-bold rounded-2xl"
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
                className="flex-1 rounded-2xl"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'SUPPRIMER'}
                className="flex-1 rounded-2xl font-bold"
              >
                {deleting ? 'Suppression...' : '🗑️ Supprimer définitivement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
