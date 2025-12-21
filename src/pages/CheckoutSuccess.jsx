import { Link } from 'react-router-dom';

export default function CheckoutSuccess() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-extrabold text-gray-900">Commande confirmée</h1>
      <p className="mt-3 text-gray-600">
        Merci ! Votre paiement a été validé. Le pizzaiolo voit maintenant votre commande.
      </p>

      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          to="/trucks"
          className="rounded-md bg-gray-900 px-4 py-2 text-white font-semibold hover:bg-gray-800"
        >
          Revenir aux camions
        </Link>
        <Link
          to="/pizzaiolo/orders"
          className="rounded-md bg-gray-100 px-4 py-2 text-gray-900 font-semibold hover:bg-gray-200"
        >
          Voir commandes (pizzaiolo)
        </Link>
      </div>
    </div>
  );
}
