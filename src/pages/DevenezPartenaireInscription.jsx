import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ROUTES } from '../app/routes';
import BackButton from '../components/ui/BackButton';

const COUNTRIES = [
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', example: '06 86 26 44 44' },
  { code: 'BE', name: 'Belgique', dial: '+32', flag: '🇧🇪', example: '0470 12 34 56' },
  { code: 'CH', name: 'Suisse', dial: '+41', flag: '🇨🇭', example: '079 123 45 67' },
  { code: 'LU', name: 'Luxembourg', dial: '+352', flag: '🇱🇺', example: '621 123 456' },
];

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export default function DevenezPartenaireInscription() {
  const navigate = useNavigate();
  const [isFoodTruck, setIsFoodTruck] = useState(null); // true | false | null

  const [managerName, setManagerName] = useState('');
  const [countryCode, setCountryCode] = useState('FR');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0],
    [countryCode]
  );

  const phoneDigits = digitsOnly(phone);

  const canSubmit =
    isFoodTruck === true &&
    managerName.trim().length >= 2 &&
    email.trim().includes('@') &&
    (countryCode === 'FR' ? phoneDigits.length === 10 : phoneDigits.length >= 6);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    // MVP UI-only: pas d'envoi backend ici.
    // Plus tard: enregistrer en RTDB + démarrer onboarding pizzaiolo.
    console.log('[PLANIZZA] Partner lead', {
      isFoodTruck,
      managerName: managerName.trim(),
      country: countryCode,
      phoneDigits,
      email: email.trim(),
    });

    const url = new URL(ROUTES.becomePartnerValidation, window.location.origin);
    url.searchParams.set('email', email.trim());
    navigate(url.pathname + url.search);
  };

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <BackButton className="mb-6" />

        <h1 className="mt-6 text-2xl font-bold text-gray-900">Pourriez-vous nous fournir vos coordonnées ?</h1>

        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
        <div>
          <p className="text-sm font-semibold text-gray-900">Exercez-vous dans un camion / FoodTruck ?</p>
          <div className="mt-3 flex gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-900">
              <input
                type="radio"
                name="isFoodTruck"
                checked={isFoodTruck === true}
                onChange={() => setIsFoodTruck(true)}
              />
              Oui
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-900">
              <input
                type="radio"
                name="isFoodTruck"
                checked={isFoodTruck === false}
                onChange={() => setIsFoodTruck(false)}
              />
              Non
            </label>
          </div>
        </div>

        {isFoodTruck === true ? (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-900">Gérant de l'établissement*</label>
              <div className="mt-2">
                <Input
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Ex : Antoine Martin"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900">Numéro de téléphone*</label>
              <div className="mt-2 flex overflow-hidden rounded-md border border-gray-300 bg-white">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-3 text-sm text-gray-900 outline-none border-r border-gray-300 bg-white"
                  aria-label="Pays (drapeau)"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 px-3 text-sm text-gray-700 border-r border-gray-300 whitespace-nowrap">
                  <span>{country.dial}</span>
                </div>

                <div className="flex-1">
                  <input
                    value={phone}
                    onChange={(e) => {
                      const next = digitsOnly(e.target.value);
                      setPhone(next);
                    }}
                    inputMode="numeric"
                    placeholder={`Ex : ${country.example}`}
                    className="w-full px-3 py-2 text-sm outline-none"
                    aria-label="Numéro de téléphone"
                    required
                  />
                </div>
              </div>
              {countryCode === 'FR' && (
                <p className="mt-2 text-xs text-gray-600">Format attendu : 10 chiffres (ex: 06XXXXXXXX).</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900">Email*</label>
              <div className="mt-2">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex : antoine.martin@gmail.com"
                  type="email"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <Button className="w-full py-4" disabled={!canSubmit}>
                Valider
              </Button>
            </div>
          </>
        ) : isFoodTruck === false ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            Pour l’instant, l’inscription est optimisée pour les camions / foodtrucks. Sélectionnez « Oui » pour continuer.
          </div>
        ) : null}
        </form>
      </div>
    </div>
  );
}
