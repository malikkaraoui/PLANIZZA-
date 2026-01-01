import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { ref, remove, get, set } from 'firebase/database';
import { useAuth } from '../app/providers/AuthProvider';
import { ROUTES } from '../app/routes';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import Card from '../components/ui/Card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { useLoyaltyPoints } from '../features/users/hooks/useLoyaltyPoints';
import LoyaltyProgressBar from '../components/loyalty/LoyaltyProgressBar';

export default function Account() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);
  const { flushToStorage } = useCart();
  
  // Carte de fidélité
  const { points, currentTier, nextTier, progress, maxTierReached, loading: loyaltyLoading } = useLoyaltyPoints(user?.uid);

  // Profil éditable
  const [isEditing, setIsEditing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+33');
  
  // Adresse décomposée
  const [streetNumber, setStreetNumber] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('France');
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Charger les données du profil
  useEffect(() => {
    if (!user?.uid || !isAuthenticated) return;

    const loadProfile = async () => {
      try {
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        
        if (snap.exists()) {
          const data = snap.val();
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
        }
      } catch (err) {
        console.error('[PLANIZZA] Erreur chargement profil:', err);
      }
    };

    loadProfile();
  }, [user?.uid, isAuthenticated]);

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

      await set(ref(db, `users/${user.uid}`), {
        displayName: user.displayName || '',
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
        updatedAt: Date.now()
      });

      setMessage('✅ Profil sauvegardé avec succès !');
      setIsEditing(false);
      
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
              <p className="text-sm font-semibold text-gray-900">📱 Téléphone</p>
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
        </div>
      </Card>
    </div>
  );
}
