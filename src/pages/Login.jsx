import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { upsertUserProfile } from '../lib/userProfile';
import { LogIn, Chrome } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const formRef = useRef(null);

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

  // Détection de l'auto-remplissage par gestionnaire de mots de passe
  // pour soumettre automatiquement le formulaire (sans friction)
  useEffect(() => {
    if (!emailRef.current || !passwordRef.current) return;

    let autosubmitTimer = null;

    // Gestionnaires de mots de passe déclenchent soit 'animationstart' (Chrome/Edge avec :-webkit-autofill),
    // soit 'input' avec valeur déjà remplie (Firefox, Safari).
    const checkAutofillAndSubmit = () => {
      // Attendre un court instant pour que les deux champs soient remplis
      clearTimeout(autosubmitTimer);
      autosubmitTimer = setTimeout(() => {
        const emailFilled = emailRef.current?.value?.trim().length > 0;
        const passwordFilled = passwordRef.current?.value?.trim().length > 0;

        // Si les deux sont remplis ET qu'on n'est pas déjà en train de charger, soumettre
        if (emailFilled && passwordFilled && !loading && formRef.current) {
          formRef.current.requestSubmit();
        }
      }, 300);
    };

    // Chrome/Edge: détecte l'animation CSS :-webkit-autofill
    const handleAnimation = (e) => {
      if (e.animationName === 'onAutoFillStart') {
        checkAutofillAndSubmit();
      }
    };

    // Firefox/Safari: détecte l'événement 'input' après autofill
    const handleInput = () => {
      checkAutofillAndSubmit();
    };

    emailRef.current.addEventListener('animationstart', handleAnimation);
    passwordRef.current.addEventListener('animationstart', handleAnimation);
    emailRef.current.addEventListener('input', handleInput);
    passwordRef.current.addEventListener('input', handleInput);

    return () => {
      clearTimeout(autosubmitTimer);
      emailRef.current?.removeEventListener('animationstart', handleAnimation);
      passwordRef.current?.removeEventListener('animationstart', handleAnimation);
      emailRef.current?.removeEventListener('input', handleInput);
      passwordRef.current?.removeEventListener('input', handleInput);
    };
  }, [loading]);

  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <CardDescription>
            Pas de compte ?{' '}
            <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Créer un compte
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form ref={formRef} className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Email
              </label>
              <Input
                ref={emailRef}
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                type="email" 
                placeholder="votre@email.com"
                autoComplete="email"
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Mot de passe
              </label>
              <Input
                ref={passwordRef}
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                type="password" 
                placeholder="••••••••"
                autoComplete="current-password"
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
                Firebase n'est pas configuré. Pour tester la connexion, remplis
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">.env.local</code>
                (voir <code className="rounded bg-amber-100 px-1 py-0.5">.env.example</code>).
              </div>
            )}

            <Button className="w-full" type="submit" disabled={loading || !isFirebaseConfigured}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? 'Connexion…' : 'Se connecter'}
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
            onClick={onGoogleLogin}
            disabled={loading || !isFirebaseConfigured}
          >
            <Chrome className="mr-2 h-4 w-4" />
            Continuer avec Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
