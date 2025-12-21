import { Link, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import { ROUTES } from '../app/routes';
import PartnerTapbar from '../components/partner/PartnerTapbar';

export default function DevenezPartenaireValidation() {
  const [searchParams] = useSearchParams();
  const email = (searchParams.get('email') || '').trim();

  return (
    <div>
      <PartnerTapbar />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Demande envoyée</h1>
        <p className="mt-3 text-gray-700">
          Un email vous a été envoyé pour finaliser le partenariat.
        </p>
        {email && (
          <p className="mt-2 text-sm text-gray-600">
            Adresse : <span className="font-semibold text-gray-900">{email}</span>
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to={ROUTES.explore}>
            <Button>Retour à l’exploration</Button>
          </Link>
          <Link to={ROUTES.becomePartner}>
            <Button variant="outline">Revenir à l’espace pro</Button>
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Pensez à vérifier vos spams. (MVP : message simulé, l’envoi d’email sera branché côté serveur ensuite.)
        </p>
      </div>
    </div>
  );
}
