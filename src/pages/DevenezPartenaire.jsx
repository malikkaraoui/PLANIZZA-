import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ROUTES } from '../app/routes';
import PartnerTapbar from '../components/partner/PartnerTapbar';

export default function DevenezPartenaire() {
  return (
    <div>
      <PartnerTapbar />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900">Devenir partenaire PLANIZZA Pro</h1>
        <p className="mt-2 text-gray-700">Soyez visibles auprès de 68 millions d'utilisateurs.</p>

        <div className="mt-6 space-y-2 text-gray-900">
          <p>✅ Sans engagement</p>
          <p>✅ Sans commission</p>
        </div>

        <div className="mt-10">
          <Link to={ROUTES.becomePartnerForm}>
            <Button className="w-full py-4 text-base">
              Je suis gérant d'un camion ou un point de vente de pizza 🍕 -&gt;
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
