import { Home as HomeIcon, CreditCard, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Bienvenue sur PLANIZZA
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Votre plateforme de gestion et planification nouvelle génération
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex justify-center mb-4">
              <HomeIcon className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
              Accueil Intuitif
            </h3>
            <p className="text-gray-600 text-center">
              Interface simple et élégante pour gérer tous vos projets
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex justify-center mb-4">
              <Calendar className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
              Planification
            </h3>
            <p className="text-gray-600 text-center">
              Organisez vos tâches et rendez-vous efficacement
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex justify-center mb-4">
              <CreditCard className="w-12 h-12 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
              Paiements Sécurisés
            </h3>
            <p className="text-gray-600 text-center">
              Intégration Stripe pour des transactions en toute sécurité
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link 
            to="/pricing"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transition-colors"
          >
            Commencer maintenant
          </Link>
        </div>
      </div>
    </div>
  );
}
