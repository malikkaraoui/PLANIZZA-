import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, set, push, get } from 'firebase/database';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePizzaioloProfile } from '../../features/users/hooks/usePizzaioloProfile';
import { db, auth } from '../../lib/firebase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import PhoneInputWithPrefix from '../../components/ui/PhoneInputWithPrefix';
import { generateUniqueTruckSlug } from '../../features/trucks/utils/truckSlug';
import LocationPicker from '../../components/ui/LocationPicker';
import { ROUTES } from '../../app/routes';
import BackButton from '../../components/ui/BackButton';
import { Eye, EyeOff } from 'lucide-react';

export default function CreateTruck() {
  const { user, isAuthenticated } = useAuth();
  usePizzaioloProfile(); // Hook utilisé pour la détection du profil
  const navigate = useNavigate();

  // Vérifier si le pizzaiolo a déjà un camion
  useEffect(() => {
    if (!user?.uid) return;

    const checkExistingTruck = async () => {
      const pizzaioloSnap = await get(ref(db, `pizzaiolos/${user.uid}/truckId`));
      if (pizzaioloSnap.exists() && pizzaioloSnap.val()) {
        // Rediriger vers le profil du camion existant
        navigate(ROUTES.pizzaioloProfile, { replace: true });
      }
    };

    checkExistingTruck();
  }, [user?.uid, navigate]);

  // Récupérer le nom de l'utilisateur connecté (si connecté)
  const userDisplayName = user?.displayName || '';
  const [_userFirstName, userLastName] = userDisplayName.split(' ').length >= 2
    ? [userDisplayName.split(' ')[0], userDisplayName.split(' ').slice(1).join(' ')]
    : ['', userDisplayName];

  // États du formulaire
  // Étape 0 = Création compte (si pas connecté), 1 = Légal, 2 = Camion, 3 = Horaires
  const [step, setStep] = useState(0);

  // Si l'utilisateur est déjà connecté au chargement, passer directement à l'étape 1
  useEffect(() => {
    if (isAuthenticated && step === 0) {
      setStep(1);
      // Pré-remplir l'email professionnel si on a l'email
      if (user?.email) {
        setProfessionalEmail(user.email);
      }
    }
  }, [isAuthenticated, user?.email, step]);

  // Étape 0: Création du compte Firebase Auth
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Étape 1: Informations légales
  const [siret, setSiret] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [nafCode, setNafCode] = useState('');
  const [managerFirstName, setManagerFirstName] = useState('');
  const [managerLastName, setManagerLastName] = useState('');
  const [siretValid, setSiretValid] = useState(null); // null | 'incomplete' | 'checking' | 'valid' | 'invalid' | 'name_mismatch'

  // Téléphone
  const [phoneNumber, setPhoneNumber] = useState('');

  // Email professionnel (pour Stripe Connect) - pré-rempli avec l'email du compte
  const [professionalEmail, setProfessionalEmail] = useState('');

  // Étape 2: Informations du camion
  const [truckName, setTruckName] = useState('');
  const [truckDescription, setTruckDescription] = useState('');
  const [location, setLocation] = useState(null);
  // Logo et photo seront ajoutés depuis le dashboard (nécessite authentification Firebase Storage)
  const [ovenType, setOvenType] = useState('Bois');
  
  // Badges
  const [badges, setBadges] = useState({
    bio: false,
    terroir: false,
    sansGluten: false,
    halal: false,
    kasher: false,
    sucre: false
  });

  // Livraison
  const [deliveryOptions] = useState({
    deliveroo: false,
    uber: false
  });

  // Étape 3: Horaires
  const [openingHours, setOpeningHours] = useState({
    monday: { enabled: true, open: '11:00', close: '22:00' },
    tuesday: { enabled: true, open: '11:00', close: '22:00' },
    wednesday: { enabled: true, open: '11:00', close: '22:00' },
    thursday: { enabled: true, open: '11:00', close: '22:00' },
    friday: { enabled: true, open: '11:00', close: '22:00' },
    saturday: { enabled: true, open: '11:00', close: '23:00' },
    sunday: { enabled: false, open: '11:00', close: '22:00' }
  });

  const [pizzaPerHour, setPizzaPerHour] = useState(30);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fonction de formatage du SIRET : XXX XXX XXX XXXXX
  const formatSiret = (value) => {
    // Ne garder que les chiffres
    const digits = value.replace(/\D/g, '');
    
    // Limiter à 14 chiffres
    const limited = digits.slice(0, 14);
    
    // Formater : 3-3-3-5
    let formatted = '';
    if (limited.length > 0) {
      formatted = limited.slice(0, 3);
      if (limited.length > 3) {
        formatted += ' ' + limited.slice(3, 6);
      }
      if (limited.length > 6) {
        formatted += ' ' + limited.slice(6, 9);
      }
      if (limited.length > 9) {
        formatted += ' ' + limited.slice(9, 14);
      }
    }
    
    return formatted;
  };

  const handleSiretChange = (e) => {
    const formatted = formatSiret(e.target.value);
    setSiret(formatted);
    
    // Réinitialiser la validation dès qu'on modifie
    const digits = formatted.replace(/\D/g, '');
    if (digits.length < 14) {
      setSiretValid('incomplete');
      // Réinitialiser aussi les champs pré-remplis
      setCompanyName('');
      setNafCode('');
      setManagerFirstName('');
      setManagerLastName('');
    } else if (digits.length === 14) {
      // Lancer la vérification automatiquement
      setSiretValid('checking');
      verifySiret(digits);
    }
  };

  // Fonction de vérification SIRET (API recherche-entreprises.api.gouv.fr)
  const verifySiret = async (cleanSiret) => {
    if (!cleanSiret || cleanSiret.length !== 14) {
      setSiretValid('incomplete');
      return;
    }

    try {
      // PREMIÈRE VÉRIFICATION : Le SIRET existe-t-il déjà dans la base ?
      const trucksRef = ref(db, 'public/trucks');
      const trucksSnap = await get(trucksRef);
      
      if (trucksSnap.exists()) {
        const trucks = trucksSnap.val();
        const existingTruck = Object.values(trucks).find(
          truck => truck.siret === cleanSiret || truck.legal?.siret === cleanSiret
        );
        
        if (existingTruck) {
          console.log('[PLANIZZA] SIRET déjà utilisé:', cleanSiret);
          setSiretValid('already_exists');
          return;
        }
      }

      // DEUXIÈME VÉRIFICATION : API gouvernementale
      const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}`,
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Vérifier qu'on a des résultats
        if (data.results && data.results.length > 0) {
          const entreprise = data.results[0];
          
          // Pré-remplir le nom de la société
          if (entreprise.nom_complet) {
            setCompanyName(entreprise.nom_complet);
          } else if (entreprise.nom_raison_sociale) {
            setCompanyName(entreprise.nom_raison_sociale);
          }
          
          // Pré-remplir le code NAF/APE
          if (entreprise.activite_principale) {
            const naf = entreprise.activite_principale;
            const label = entreprise.libelle_activite_principale || '';
            setNafCode(label ? `${naf} - ${label}` : naf);
          } else if (entreprise.section_activite_principale) {
            setNafCode(entreprise.section_activite_principale);
          }
          
          // Vérifier si le code NAF est autorisé (56.10C = Restauration de type rapide)
          const nafPrincipal = entreprise.activite_principale || '';
          if (nafPrincipal !== '56.10C') {
            setSiretValid('invalid');
            return;
          }
          
          // Pré-remplir le nom du dirigeant si disponible
          let siretLastName = '';
          
          if (entreprise.dirigeants && entreprise.dirigeants.length > 0) {
            const dirigeant = entreprise.dirigeants[0];
            
            // Cas 1: prénom et nom séparés
            if (dirigeant.prenom && dirigeant.nom) {
              setManagerFirstName(dirigeant.prenom.trim());
              setManagerLastName(dirigeant.nom.trim());
              siretLastName = dirigeant.nom.trim().toLowerCase();
            }
            // Cas 2: prenoms (pluriel) et nom
            else if (dirigeant.prenoms && dirigeant.nom) {
              // Prendre le premier prénom s'il y en a plusieurs
              const prenom = dirigeant.prenoms.trim().split(' ')[0];
              setManagerFirstName(prenom);
              setManagerLastName(dirigeant.nom.trim());
              siretLastName = dirigeant.nom.trim().toLowerCase();
            }
            // Cas 3: nom complet dans un seul champ
            else if (dirigeant.nom) {
              const nomComplet = dirigeant.nom.trim();
              const parts = nomComplet.split(' ');
              
              if (parts.length >= 2) {
                // Premier mot = prénom, reste = nom
                setManagerFirstName(parts[0]);
                setManagerLastName(parts.slice(1).join(' '));
                siretLastName = parts.slice(1).join(' ').toLowerCase();
              } else {
                // Si un seul mot, le mettre dans nom de famille
                setManagerLastName(nomComplet);
                siretLastName = nomComplet.toLowerCase();
              }
            }
            // Cas 4: nom_patronymique (certaines structures de l'API)
            else if (dirigeant.nom_patronymique) {
              const nomComplet = dirigeant.nom_patronymique.trim();
              const parts = nomComplet.split(' ');
              
              if (parts.length >= 2) {
                setManagerFirstName(parts[0]);
                setManagerLastName(parts.slice(1).join(' '));
                siretLastName = parts.slice(1).join(' ').toLowerCase();
              } else {
                setManagerLastName(nomComplet);
                siretLastName = nomComplet.toLowerCase();
              }
            }
          }
          
          // Vérifier que le gérant du SIRET correspond à l'utilisateur connecté
          const userLastLower = userLastName.toLowerCase().trim();
          
          // Vérifier que les noms correspondent (au moins le nom de famille doit correspondre)
          if (siretLastName && userLastLower) {
            const lastNameMatches = siretLastName === userLastLower || 
                                   siretLastName.includes(userLastLower) || 
                                   userLastLower.includes(siretLastName);
            
            if (!lastNameMatches) {
              setSiretValid('name_mismatch');
              return;
            }
          }
          
          console.log('[PLANIZZA] Données entreprise:', entreprise);
          
          setSiretValid('valid');
        } else {
          setSiretValid('invalid');
        }
      } else {
        setSiretValid('invalid');
      }
    } catch (err) {
      console.error('Erreur vérification SIRET:', err);
      setSiretValid('invalid');
    }
  };

  const isNafValid = nafCode.startsWith('56.10C');
  
  const phoneDigits = phoneNumber.replace(/\D/g, '');

  // Étape 0: validation compte
  const canGoToStep1 = accountEmail.includes('@') && accountPassword.length >= 6;

  // Le format PhoneInputWithPrefix est "6 XX XX XX XX" = 9 chiffres (sans le 0 initial)
  const canGoToStep2 = siretValid === 'valid' &&
                       isNafValid &&
                       companyName.trim().length >= 2 &&
                       managerFirstName.trim().length >= 2 &&
                       managerLastName.trim().length >= 2 &&
                       phoneDigits.length === 9 &&
                       professionalEmail.includes('@');

  // Étape 0: On ne crée PAS le compte ici, on passe juste à l'étape suivante
  // Le compte sera créé à la FIN du formulaire (handleSubmit)
  const handleGoToStep1 = () => {
    // Pré-remplir l'email professionnel avec l'email du compte
    setProfessionalEmail(accountEmail);
    setStep(1);
  };

  // Connexion avec Google (étape 0)
  // Note: Google crée le compte immédiatement, on ne peut pas différer
  // Mais c'est acceptable car l'utilisateur a fait un choix actif (popup Google)
  const handleGoogleSignIn = async () => {
    setCreatingAccount(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('[CreateTruck] Connexion Google réussie');

      // Pré-remplir l'email professionnel avec l'email Google
      if (result.user?.email) {
        setProfessionalEmail(result.user.email);
      }

      // Passer à l'étape 1
      setStep(1);
    } catch (err) {
      console.error('[CreateTruck] Erreur Google:', err);
      setError(err.message || 'Erreur lors de la connexion Google');
    } finally {
      setCreatingAccount(false);
    }
  };

  // Logo et photo sont ajoutés plus tard dans le dashboard (après création du compte)
  // Car l'upload Firebase Storage nécessite une authentification
  const canGoToStep3 = truckName.trim().length >= 2 &&
                       truckDescription.trim().length >= 10 &&
                       location?.lat &&
                       location?.lng;

  const canSubmit = Object.values(openingHours).some(day => day.enabled) &&
                    pizzaPerHour >= 10;

  // Menu sera créé plus tard depuis le dashboard pizzaiolo

  const handleSubmit = async () => {
    setSaving(true);
    setError('');

    try {
      let currentUser = user;

      // Si pas connecté, créer le compte Firebase Auth maintenant
      // C'est le SEUL moment où on crée le compte - à la toute fin du formulaire
      if (!isAuthenticated) {
        console.log('[CreateTruck] Création du compte Firebase Auth...');
        const userCredential = await createUserWithEmailAndPassword(auth, accountEmail, accountPassword);
        currentUser = userCredential.user;

        // Définir le displayName avec le prénom du gérant
        const fullName = `${managerFirstName.trim()} ${managerLastName.trim()}`;
        await updateProfile(currentUser, { displayName: fullName });
        console.log('[CreateTruck] Compte créé avec displayName:', fullName);
      }

      if (!currentUser?.uid) {
        setError('Erreur: impossible de créer le compte');
        return;
      }

      const slug = await generateUniqueTruckSlug({
        db,
        name: truckName.trim(),
        suffixLength: 3,
      });
      const truckRef = push(ref(db, 'public/trucks'));
      const truckId = truckRef.key;

      const truckData = {
        name: truckName.trim(),
        slug,
        description: truckDescription.trim(),
        siret: siret.replace(/\s/g, ''), // SIRET au premier niveau pour faciliter la recherche
        location: {
          lat: location.lat,
          lng: location.lng,
          address: location.address || ''
        },
        // Logo et photo seront ajoutés depuis le dashboard
        logoUrl: '',
        photoUrl: '',
        ovenType,
        badges,
        deliveryOptions,
        openingHours,
        capacity: {
          pizzaPerHour: parseInt(pizzaPerHour, 10)
        },
        legal: {
          siret: siret.replace(/\s/g, ''),
          companyName: companyName.trim(),
          managerFirstName: managerFirstName.trim(),
          managerLastName: managerLastName.trim(),
          phoneNumber: phoneNumber ? `+33${phoneNumber.replace(/\s/g, '')}` : '',
          professionalEmail: professionalEmail.trim().toLowerCase(),
        },
        menu: {
          items: {} // Menu vide, sera rempli depuis le dashboard
        },
        ratingAvg: 0,
        ratingCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerId: currentUser.uid
      };

      // Créer le camion
      await set(truckRef, truckData);

      // Lier le camion au pizzaiolo (avec email pour Stripe Connect)
      const pizzaioloRef = ref(db, `pizzaiolos/${currentUser.uid}`);
      await set(pizzaioloRef, {
        truckId,
        professionalEmail: professionalEmail.trim().toLowerCase(),
        createdAt: Date.now()
      });

      // Rediriger vers le dashboard pro
      navigate(ROUTES.pizzaioloProfile);
    } catch (err) {
      console.error('[PLANIZZA] Erreur création camion:', err);

      // Gérer les erreurs Firebase Auth
      if (err.code === 'auth/email-already-in-use') {
        setError('Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.');
      } else if (err.code === 'auth/weak-password') {
        setError('Le mot de passe doit contenir au moins 6 caractères.');
      } else if (err.code === 'auth/invalid-email') {
        setError('L\'email n\'est pas valide.');
      } else {
        setError(err.message || 'Impossible de créer votre camion. Réessayez plus tard.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Labels des étapes
  const stepLabels = {
    0: 'Créer votre compte',
    1: 'Informations légales',
    2: 'Votre camion',
    3: 'Horaires & Capacité',
  };

  // Nombre total d'étapes (4 si pas connecté, 3 si déjà connecté)
  const totalSteps = isAuthenticated ? 3 : 4;
  const displayStep = isAuthenticated ? step : step + 1; // Pour afficher 1-4 au lieu de 0-3

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <BackButton className="mb-6" />
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  s === displayStep
                    ? 'bg-emerald-600 text-white'
                    : s < displayStep
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < totalSteps && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    s < displayStep ? 'bg-emerald-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 text-center">
          <p className="text-sm font-semibold text-gray-900">
            {stepLabels[step]}
          </p>
        </div>
      </div>

      {/* Étape 0: Création du compte */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Créer votre compte professionnel</h2>
            <p className="mt-2 text-sm text-gray-600">
              Créez votre compte pour gérer votre camion pizza sur PLANIZZA.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Email *
            </label>
            <Input
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="contact@monpizza.com"
              className="mt-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Mot de passe *
            </label>
            <div className="relative mt-2">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">Minimum 6 caractères</p>
          </div>

          <Button
            onClick={handleGoToStep1}
            disabled={!canGoToStep1}
            className="w-full"
          >
            Continuer →
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500">ou</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={creatingAccount}
            className="w-full"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </Button>

          <p className="text-center text-sm text-gray-600">
            Déjà un compte pro ?{' '}
            <button
              onClick={() => navigate('/login')}
              className="font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Se connecter
            </button>
          </p>
        </div>
      )}

      {/* Étape 1: Informations légales */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Informations légales</h2>
            <p className="mt-2 text-sm text-gray-600">
              Ces informations ne sont pas publiques et servent uniquement à vérifier votre identité.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Numéro SIRET *
            </label>
            <Input
              value={siret}
              onChange={handleSiretChange}
              placeholder="123 456 789 00010"
              className="mt-2"
              maxLength={17}
            />
            {siretValid === 'checking' && (
              <p className="mt-1 text-sm text-blue-600">🔍 Vérification en cours...</p>
            )}
            {siretValid === 'incomplete' && siret.length > 0 && (
              <p className="mt-1 text-sm text-gray-500">⚠️ Numéro incomplet (14 chiffres requis)</p>
            )}
            {siretValid === 'valid' && (
              <p className="mt-1 text-sm text-emerald-600">✓ SIRET valide</p>
            )}
            {siretValid === 'invalid' && (
              <p className="mt-1 text-sm text-red-600">✗ Ce numéro SIRET n'existe pas</p>
            )}
            {siretValid === 'name_mismatch' && (
              <p className="mt-1 text-sm text-red-600">
                ✗ Le gérant de ce SIRET ne correspond pas à votre identité ({userDisplayName}). 
                Vous ne pouvez créer un camion qu'avec votre propre entreprise.
              </p>
            )}
            {siretValid === 'already_exists' && (
              <p className="mt-1 text-sm text-red-600">
                ✗ Ce SIRET est déjà utilisé par un autre camion sur PLANIZZA
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Nom de la société *
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Pizza Paradiso SARL"
              className="mt-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Activité principale (NAF/APE)
            </label>
            <Input
              value={nafCode}
              readOnly
              placeholder="Renseigné automatiquement"
              className={`mt-2 ${nafCode && !isNafValid ? 'bg-red-50 border-red-300' : 'bg-gray-50'}`}
              disabled
            />
            {nafCode && !isNafValid && (
              <p className="mt-1 text-sm text-red-600">
                ✗ Seuls les établissements avec le code NAF 56.10C (Restauration de type rapide) peuvent s'inscrire
              </p>
            )}
            {nafCode && isNafValid && (
              <p className="mt-1 text-xs text-emerald-600">
                ✓ Code NAF autorisé
              </p>
            )}
            {!nafCode && (
              <p className="mt-1 text-xs text-gray-500">
                Code NAF/APE extrait automatiquement du SIRET
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900">
                Prénom du gérant *
              </label>
              <Input
                value={managerFirstName}
                onChange={(e) => setManagerFirstName(e.target.value)}
                placeholder="Marco"
                className="mt-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900">
                Nom du gérant *
              </label>
              <Input
                value={managerLastName}
                onChange={(e) => setManagerLastName(e.target.value)}
                placeholder="Rossi"
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Téléphone *
            </label>
            <PhoneInputWithPrefix
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder="6 51 21 47 82"
              className="mt-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Email professionnel *
            </label>
            <Input
              type="email"
              value={professionalEmail}
              onChange={(e) => setProfessionalEmail(e.target.value)}
              placeholder="contact@votreentreprise.fr"
              className="mt-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Utilisé pour configurer les paiements Stripe Connect
            </p>
          </div>

          <Button
            onClick={() => setStep(2)}
            disabled={!canGoToStep2}
            className="w-full"
          >
            Continuer →
          </Button>
        </div>
      )}

      {/* Étape 2: Camion */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Votre camion</h2>
            <p className="mt-2 text-sm text-gray-600">
              Ces informations seront visibles publiquement par vos clients.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Nom du camion *
            </label>
            <Input
              value={truckName}
              onChange={(e) => setTruckName(e.target.value)}
              placeholder="Pizza Paradiso"
              className="mt-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Description *
            </label>
            <textarea
              value={truckDescription}
              onChange={(e) => setTruckDescription(e.target.value)}
              placeholder="Pizzas artisanales au feu de bois..."
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Localisation *
            </label>
            <div className="mt-2">
              <LocationPicker
                value={location}
                onChange={setLocation}
              />
            </div>
          </div>

          {/* Logo et photo seront ajoutés dans le dashboard après création du compte */}
          {/* Car l'upload Firebase Storage nécessite une authentification */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              📸 <strong>Logo et photos</strong> : vous pourrez ajouter votre logo et vos photos
              depuis votre tableau de bord après la création de votre compte.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Type de four
            </label>
            <select
              value={ovenType}
              onChange={(e) => setOvenType(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="Bois">Bois</option>
              <option value="Gaz">Gaz</option>
              <option value="Électrique">Électrique</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Badges (optionnel)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries({
                bio: 'Bio',
                terroir: 'Terroir',
                sansGluten: 'Sans gluten',
                halal: 'Halal',
                kasher: 'Kasher',
                sucre: 'Sucré'
              }).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={badges[key]}
                    onChange={(e) => setBadges({ ...badges, [key]: e.target.checked })}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1"
            >
              ← Retour
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!canGoToStep3}
              className="flex-1"
            >
              Continuer →
            </Button>
          </div>
          
          {/* Message d'aide si des champs manquent */}
          {!canGoToStep3 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold text-amber-900 mb-2">📋 Champs manquants :</p>
              <ul className="text-sm text-amber-800 space-y-1">
                {truckName.trim().length < 2 && <li>• Nom du camion (min 2 caractères)</li>}
                {truckDescription.trim().length < 10 && <li>• Description (min 10 caractères)</li>}
                {!location?.lat && <li>• Localisation (cliquez sur la carte)</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Étape 3: Horaires */}
      {/* Étape 3: Horaires */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Horaires & Capacité</h2>
            <p className="mt-2 text-sm text-gray-600">
              Définissez vos horaires d'ouverture et votre capacité de production.
            </p>
          </div>

          <div className="space-y-3">
            {Object.entries({
              monday: 'Lundi',
              tuesday: 'Mardi',
              wednesday: 'Mercredi',
              thursday: 'Jeudi',
              friday: 'Vendredi',
              saturday: 'Samedi',
              sunday: 'Dimanche'
            }).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-32">
                  <input
                    type="checkbox"
                    checked={openingHours[key].enabled}
                    onChange={(e) => setOpeningHours({
                      ...openingHours,
                      [key]: { ...openingHours[key], enabled: e.target.checked }
                    })}
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>

                {openingHours[key].enabled && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={openingHours[key].open}
                      onChange={(e) => setOpeningHours({
                        ...openingHours,
                        [key]: { ...openingHours[key], open: e.target.value }
                      })}
                      className="w-32"
                    />
                    <span className="text-sm text-gray-600">à</span>
                    <Input
                      type="time"
                      value={openingHours[key].close}
                      onChange={(e) => setOpeningHours({
                        ...openingHours,
                        [key]: { ...openingHours[key], close: e.target.value }
                      })}
                      className="w-32"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Capacité (pizzas par heure) *
            </label>
            <Input
              type="number"
              value={pizzaPerHour}
              onChange={(e) => setPizzaPerHour(e.target.value)}
              placeholder="30"
              className="mt-2"
              min="10"
              max="100"
            />
            <p className="mt-1 text-xs text-gray-600">
              Cette valeur permet de calculer les temps d'attente estimés
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="flex-1"
            >
              ← Retour
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || saving}
              className="flex-1"
            >
              {saving ? 'Création en cours...' : 'Créer mon camion 🍕'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
