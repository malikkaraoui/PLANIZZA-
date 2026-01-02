import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { upsertUserProfile } from '../lib/userProfile';
import { UserPlus, Chrome } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onGoogleRegister = async () => {
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
      
      // Si l'utilisateur n'a pas de displayName ou phoneNumber, rediriger vers complete-profile
      if (!cred.user.displayName || !cred.user.phoneNumber) {
        navigate('/complete-profile');
      } else {
        navigate('/explore');
      }
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
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await upsertUserProfile(cred.user);
      // Toujours rediriger vers complete-profile pour les inscriptions email/mot de passe
      navigate('/complete-profile');
    } catch (err) {
      setError(err?.message || 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Créer un compte</CardTitle>
          <CardDescription>
            Déjà un compte ?{' '}
            <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Se connecter
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Email
              </label>
              <Input 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                type="email" 
                placeholder="votre@email.com"
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Mot de passe
              </label>
              <Input 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                type="password" 
                placeholder="••••••••"
                required 
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!isFirebaseConfigured && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                Firebase n'est pas configuré. Pour tester l'inscription, remplis
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">.env.local</code>
                (voir <code className="rounded bg-amber-100 px-1 py-0.5">.env.example</code>).
              </div>
            )}

            <Button className="w-full" type="submit" disabled={loading || !isFirebaseConfigured}>
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? 'Inscription…' : "S'inscrire"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            className="w-full"
            variant="outline"
            type="button"
            onClick={onGoogleRegister}
            disabled={loading || !isFirebaseConfigured}
          >
            <Chrome className="mr-2 h-4 w-4" />
            S'inscrire avec Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
