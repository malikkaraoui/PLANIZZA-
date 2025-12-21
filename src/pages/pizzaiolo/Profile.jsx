import Card from '../../components/ui/Card';
import { useAuth } from '../../app/providers/AuthProvider';
import { useUserProfile } from '../../features/users/hooks/useUserProfile';

function initialsFromUser({ email, displayName } = {}) {
  const base = (displayName || email || '').trim();
  if (!base) return 'P';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function PizzaioloProfile() {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();

  const email = profile?.email || user?.email || null;
  const displayName = profile?.displayName || user?.displayName || null;
  const photoURL = profile?.photoURL || user?.photoURL || null;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h1 className="text-xl font-bold text-gray-900">Mon compte</h1>
        <p className="mt-2 text-gray-600">
          {loading ? 'Chargement du profil…' : 'Informations de connexion.'}
        </p>

        <div className="mt-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full border bg-gray-50 overflow-hidden flex items-center justify-center text-sm font-extrabold text-gray-700">
            {photoURL ? (
              <img
                src={photoURL}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              initialsFromUser({ email, displayName })
            )}
          </div>

          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">
              {displayName || 'Utilisateur'}
            </div>
            <div className="text-sm text-gray-600 truncate">
              {email || 'Email indisponible'}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-900">Profil camion</h2>
        <p className="mt-2 text-gray-600">MVP : nom, description, localisation, horaires.</p>
        {/* TODO: formulaire + sauvegarde Firebase */}
      </Card>
    </div>
  );
}
