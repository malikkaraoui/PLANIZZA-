import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, set, push, get } from 'firebase/database';
import { useAuth } from '../../app/providers/AuthProvider';
import { db } from '../../lib/firebase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { generateSlug } from '../../lib/utils';
import LocationPicker from '../../components/ui/LocationPicker';
import ImageUploader from '../../components/ui/ImageUploader';
import { ROUTES } from '../../app/routes';

export default function CreateTruck() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Récupérer le nom de l'utilisateur connecté
  const userDisplayName = user?.displayName || '';
  const [userFirstName, userLastName] = userDisplayName.split(' ').length >= 2 
    ? [userDisplayName.split(' ')[0], userDisplayName.split(' ').slice(1).join(' ')]
    : ['', userDisplayName];

  // États du formulaire
  const [step, setStep] = useState(1); // 1: Légal, 2: Camion, 3: Horaires
  
  // Étape 1: Informations légales
  const [siret, setSiret] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [nafCode, setNafCode] = useState('');
  const [managerFirstName, setManagerFirstName] = useState('');
  const [managerLastName, setManagerLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [siretValid, setSiretValid] = useState(null); // null | 'incomplete' | 'checking' | 'valid' | 'invalid' | 'name_mismatch'
  const [siretChecking, setSiretChecking] = useState(false);

  // Étape 2: Informations du camion
  const [truckName, setTruckName] = useState('');
  const [truckDescription, setTruckDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
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
  const [deliveryOptions, setDeliveryOptions] = useState({
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

    setSiretChecking(true);

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
          setSiretChecking(false);
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
          let siretFirstName = '';
          let siretLastName = '';
          
          if (entreprise.dirigeants && entreprise.dirigeants.length > 0) {
            const dirigeant = entreprise.dirigeants[0];
            
            // Cas 1: prénom et nom séparés
            if (dirigeant.prenom && dirigeant.nom) {
              setManagerFirstName(dirigeant.prenom.trim());
              setManagerLastName(dirigeant.nom.trim());
              siretFirstName = dirigeant.prenom.trim().toLowerCase();
              siretLastName = dirigeant.nom.trim().toLowerCase();
            }
            // Cas 2: prenoms (pluriel) et nom
            else if (dirigeant.prenoms && dirigeant.nom) {
              // Prendre le premier prénom s'il y en a plusieurs
              const prenom = dirigeant.prenoms.trim().split(' ')[0];
              setManagerFirstName(prenom);
              setManagerLastName(dirigeant.nom.trim());
              siretFirstName = prenom.toLowerCase();
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
                siretFirstName = parts[0].toLowerCase();
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
                siretFirstName = parts[0].toLowerCase();
                siretLastName = parts.slice(1).join(' ').toLowerCase();
              } else {
                setManagerLastName(nomComplet);
                siretLastName = nomComplet.toLowerCase();
              }
            }
          }
          
          // Vérifier que le gérant du SIRET correspond à l'utilisateur connecté
          const userFirstLower = userFirstName.toLowerCase().trim();
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
    } finally {
      setSiretChecking(false);
    }
  };

  const isNafValid = nafCode.startsWith('56.10C');
  
  const canGoToStep2 = siretValid === 'valid' &&
                       isNafValid &&
                       companyName.trim().length >= 2 &&
                       managerFirstName.trim().length >= 2 &&
                       managerLastName.trim().length >= 2 &&
                       phoneNumber.replace(/\D/g, '').length >= 10;

  const canGoToStep3 = truckName.trim().length >= 2 &&
                       truckDescription.trim().length >= 10 &&
                       location?.lat &&
                       location?.lng &&
                       logoUrl &&
                       photoUrl;

  const canSubmit = Object.values(openingHours).some(day => day.enabled) &&
                    pizzaPerHour >= 10;

  // Menu sera créé plus tard depuis le dashboard pizzaiolo

  const updateMenuItem = (id, field, value) => {
    setMenuItems(menuItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const updateMenuItemSize = (itemId, sizeIndex, field, value) => {
    setMenuItems(menuItems.map(item => {
      if (item.id === itemId) {
        const newSizes = [...item.sizes];
        newSizes[sizeIndex] = { ...newSizes[sizeIndex], [field]: value };
        return { ...item, sizes: newSizes };
      }
      return item;
    }));
  };

  const removeMenuItem = (id) => {
    setMenuItems(menuItems.filter(item => item.id !== id));
  };

  const handleSubmit = async () => {
    if (!user?.uid) {
      setError('Vous devez être connecté');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const slug = generateSlug(truckName);
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
        logoUrl,
        photoUrl,
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
          phoneNumber: phoneNumber.replace(/\D/g, '')
        },
        menu: {
          items: {} // Menu vide, sera rempli depuis le dashboard
        },
        ratingAvg: 0,
        ratingCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerId: user.uid
      };

      // Créer le camion
      await set(truckRef, truckData);

      // Lier le camion au pizzaiolo
      const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
      await set(pizzaioloRef, {
        truckId,
        createdAt: Date.now()
      });

      // Rediriger vers le dashboard
      navigate(ROUTES.dashboard);
    } catch (err) {
      console.error('[PLANIZZA] Erreur création camion:', err);
      setError('Impossible de créer votre camion. Réessayez plus tard.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  s === step
                    ? 'bg-emerald-600 text-white'
                    : s < step
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    s < step ? 'bg-emerald-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 text-center">
          <p className="text-sm font-semibold text-gray-900">
            {step === 1 && 'Informations légales'}
            {step === 2 && 'Votre camion'}
            {step === 3 && 'Horaires & Capacité'}
          </p>
        </div>
      </div>

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
            <Input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="06 12 34 56 78"
              className="mt-2"
            />
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

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Logo * <span className="text-xs text-gray-500 font-normal">(Votre marque/enseigne)</span>
            </label>
            <ImageUploader
              value={logoUrl}
              onChange={setLogoUrl}
              folder="logos"
              maxWidth={500}
              maxHeight={500}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Photo du camion * <span className="text-xs text-gray-500 font-normal">(Votre véhicule)</span>
            </label>
            <ImageUploader
              value={photoUrl}
              onChange={setPhotoUrl}
              folder="trucks"
              maxWidth={1200}
              maxHeight={800}
            />
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
                {!logoUrl && <li>• Logo (uploadez votre logo)</li>}
                {!photoUrl && <li>• Photo du camion (uploadez une photo)</li>}
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
