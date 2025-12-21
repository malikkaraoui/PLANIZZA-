import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useAuth } from '../../app/providers/AuthProvider';
import { auth, isFirebaseConfigured } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useUserProfile } from '../../features/users/hooks/useUserProfile';
import CityAutocomplete from '../ui/CityAutocomplete';

function initialsFromUser({ email, displayName } = {}) {
  const base = (displayName || email || '').trim();
  if (!base) return 'P';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { profile } = useUserProfile();

  const [searchParams] = useSearchParams();

  const currentQ = useMemo(() => {
    if (!location.pathname.startsWith('/trucks')) return '';
    return (searchParams.get('q') || '').trim();
  }, [location.pathname, searchParams]);

  const currentWhere = useMemo(() => {
    if (!location.pathname.startsWith('/trucks')) return '';
    return (searchParams.get('where') || '').trim();
  }, [location.pathname, searchParams]);

  const [q, setQ] = useState('');
  const [where, setWhere] = useState('');

  useEffect(() => {
    setQ(currentQ);
  }, [currentQ]);

  useEffect(() => {
    setWhere(currentWhere);
  }, [currentWhere]);

  const onSubmit = (e) => {
    e.preventDefault();
    const nextQ = q.trim();
    const nextWhere = where.trim();
    const params = new URLSearchParams();
    if (nextQ) params.set('q', nextQ);
    if (nextWhere) params.set('where', nextWhere);
    navigate(params.toString() ? `/trucks?${params.toString()}` : '/trucks');
  };

  const onLogout = async () => {
    if (!isFirebaseConfigured || !auth) return;
    await signOut(auth);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white/85 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <Link to="/" className="font-extrabold tracking-tight text-gray-900">
          PLANIZZA
        </Link>

        <form onSubmit={onSubmit} className="flex-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Que cherchez-vous ?"
              aria-label="Que cherchez-vous"
            />
            <div className="hidden md:block w-64">
              <CityAutocomplete
                value={where}
                onChange={(next) => setWhere(next)}
                onSelect={(city) => {
                  setWhere(city.name);
                  const params = new URLSearchParams();
                  const nextQ = q.trim();
                  if (nextQ) params.set('q', nextQ);
                  if (city.name) params.set('where', city.name);
                  navigate(params.toString() ? `/trucks?${params.toString()}` : '/trucks');
                }}
                placeholder="Où"
                ariaLabel="Où"
                inputClassName="py-2"
              />
            </div>
          </div>
        </form>

        <nav className="flex items-center gap-2 text-sm">
          <Link to="/trucks" className="px-2 py-2 text-gray-700 hover:text-gray-900">
            Camions
          </Link>

          <Link to="/pizzaiolo" className="px-2 py-2 text-gray-700 hover:text-gray-900">
            Pizzaiolo
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/pizzaiolo/profile"
                className="h-9 w-9 rounded-full border bg-gray-50 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-700"
                title="Voir mon profil"
              >
                {profile?.photoURL || user?.photoURL ? (
                  <img
                    src={profile?.photoURL || user?.photoURL}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  initialsFromUser({ email: user?.email, displayName: user?.displayName })
                )}
              </Link>
              <span className="hidden sm:inline text-xs text-gray-500">
                {user?.email || 'Connecté'}
              </span>
              <Button variant="outline" onClick={onLogout} disabled={!isFirebaseConfigured}>
                Déconnexion
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button>Connexion</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
