import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/providers/AuthProvider';

export default function PizzaioloDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasTruck, setHasTruck] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const checkTruck = async () => {
      try {
        const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
        const snap = await get(pizzaioloRef);
        
        if (snap.exists() && snap.val().truckId) {
          setHasTruck(true);
          
          // Si on est sur /pro (pas de sous-route), rediriger vers truck
          if (location.pathname === '/pro') {
            navigate('/pro/truck', { replace: true });
          }
        } else {
          setHasTruck(false);
          
          // Si pas de camion, rediriger vers le profil pour en créer un
          if (location.pathname === '/pro') {
            navigate('/pro/truck', { replace: true });
          }
        }
      } catch (err) {
        console.error('Erreur vérification camion:', err);
      } finally {
        setLoading(false);
      }
    };

    checkTruck();
  }, [user?.uid, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Outlet />
    </div>
  );
}
