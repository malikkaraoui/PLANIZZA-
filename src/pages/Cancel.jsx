import { XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Cancel() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <XCircle className="w-20 h-20 text-red-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Paiement annulé
        </h1>
        
        <p className="text-gray-600 mb-6">
          Votre paiement a été annulé. Aucun montant n'a été débité.
        </p>

        <div className="space-y-3">
          <Link
            to="/pricing"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Retour aux tarifs
          </Link>
          
          <Link
            to="/"
            className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Retour à l'accueil
          </Link>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          Besoin d'aide ? Contactez notre support.
        </p>
      </div>
    </div>
  );
}
