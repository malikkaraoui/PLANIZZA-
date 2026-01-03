import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../app/routes';

export default function DevenezPartenaireValidation() {
  const [searchParams] = useSearchParams();
  const email = (searchParams.get('email') || '').trim();

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900">Bienvenue parmi nous !</h1>
          <p className="mt-3 text-lg text-gray-700">
            Votre demande a été enregistrée avec succès.
          </p>
          {email && (
            <p className="mt-2 text-sm text-gray-600">
              Un email de confirmation a été envoyé à : <span className="font-semibold text-gray-900">{email}</span>
            </p>
          )}
        </div>

        <div className="mt-12 p-6 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200">
          <h2 className="text-xl font-bold text-gray-900">🚀 Étape suivante</h2>
          <p className="mt-2 text-gray-700">
            Configurez dès maintenant votre espace professionnel : créez votre camion, ajoutez votre menu et commencez à recevoir des commandes !
          </p>
          
          <Link to={ROUTES.pizzaioloStart} className="mt-4 block">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 text-lg font-bold">
              Démarrer la configuration →
            </Button>
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
          <Link to={ROUTES.explore}>
            <Button variant="outline">Explorer les camions</Button>
          </Link>
        </div>

        <p className="mt-8 text-xs text-gray-500 text-center">
          💡 Les informations sont actuellement loguées dans la console (MVP). L'envoi d'email sera implémenté ultérieurement.
        </p>
      </div>
    </div>
  );
}
