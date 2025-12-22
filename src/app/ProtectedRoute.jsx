import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { useUserProfile } from '../features/users/hooks/useUserProfile';

export default function ProtectedRoute({ children, requirePizzaiolo = false }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const location = useLocation();

  if (authLoading || profileLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-gray-600">Chargement…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Si la route nécessite role pizzaiolo et que l'user n'en est pas un
  if (requirePizzaiolo && profile?.role !== 'pizzaiolo') {
    return <Navigate to="/pizzaiolo/start" replace />;
  }

  return children;
}
