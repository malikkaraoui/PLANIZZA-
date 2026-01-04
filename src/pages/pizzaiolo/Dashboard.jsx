import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePizzaioloTruckId } from '../../features/pizzaiolo/hooks/usePizzaioloTruckId';

export default function PizzaioloDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { truckId, loading, error } = usePizzaioloTruckId(user?.uid);

  useEffect(() => {
    if (!user?.uid) return;
    if (loading) return;

    // Si aucun camion associé -> on redirige vers la création.
    if (!truckId) {
      navigate('/pro/creer-camion', { replace: true });
    }
  }, [user?.uid, loading, truckId, location.pathname, navigate]);

  if (loading || (!truckId && !error)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-gray-600">Erreur lors du chargement de votre camion.</p>
        <p className="text-xs text-gray-400 font-mono break-all mt-2">{String(error?.message || error)}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Outlet />
    </div>
  );
}
