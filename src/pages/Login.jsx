import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { upsertUserProfile } from '../lib/userProfile';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onGoogleLogin = async () => {
    if (!isFirebaseConfigured || !auth) {
      setError(
        "Firebase n'est pas configuré. Créez un fichier .env.local et relancez le serveur."
      );
      return;
    }

    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      await upsertUserProfile(cred.user);
      navigate('/explore');
    } catch (err) {
      setError(err?.message || 'Connexion Google impossible');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isFirebaseConfigured || !auth) {
      setError(
        'Firebase n\'est pas configuré. Créez un fichier .env.local et relancez le serveur.'
      );
      return;
    }
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await upsertUserProfile(cred.user);
      navigate('/explore');
    } catch (err) {
      setError(err?.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card className="p-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Connexion pizzaiolo</h1>
        <p className="text-sm text-gray-600 mt-1">
          Pas de compte ?{' '}
          <Link to="/register" className="underline">
            Créer un compte
          </Link>
        </p>

        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Mot de passe</label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

            {!isFirebaseConfigured && (
              <div className="text-sm text-amber-700">
                Firebase n’est pas configuré. Pour tester la connexion, remplis
                <code className="mx-1 rounded bg-amber-50 px-1 py-0.5">.env.local</code>
                (voir <code className="rounded bg-amber-50 px-1 py-0.5">.env.example</code>).
              </div>
            )}

            <Button className="w-full" type="submit" disabled={loading || !isFirebaseConfigured}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>

        <div className="mt-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <div className="text-xs text-gray-500">ou</div>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <Button
            className="w-full mt-4"
            variant="outline"
            type="button"
            onClick={onGoogleLogin}
            disabled={loading || !isFirebaseConfigured}
          >
            Continuer avec Google
          </Button>
        </div>
      </Card>
    </div>
  );
}
