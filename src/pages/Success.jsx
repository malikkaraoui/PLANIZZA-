import { CheckCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';

export default function Success() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const plan = searchParams.get('plan');

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 to-green-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <BackButton className="mb-4" />
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-20 h-20 text-green-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Paiement réussi !
        </h1>
        
        <p className="text-gray-600 mb-6">
          Votre paiement a été traité avec succès.
        </p>

        {plan && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">
              Plan sélectionné : <strong className="capitalize">{plan}</strong>
            </p>
          </div>
        )}

        {sessionId && (
          <p className="text-xs text-gray-500 mb-6">
            Session ID : {sessionId}
          </p>
        )}

        <div className="space-y-3">
          <Link
            to="/"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Retour à l'accueil
          </Link>
          
          <p className="text-sm text-gray-500">
            Un email de confirmation vous a été envoyé.
          </p>
        </div>
      </div>
    </div>
  );
}
