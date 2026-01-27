import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { upsertUserProfile } from '../lib/userProfile';
import { LogIn, Chrome } from 'lucide-react';
import BackButton from '../components/ui/BackButton';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const formRef = useRef(null);

  // Détection du paramètre pizzaiolo pour afficher un message de reconnexion
  const searchParams = new URLSearchParams(location.search);
  const isPizzaioloUpgrade = searchParams.get('pizzaiolo') === 'true';
  const shouldShowReconnectMessage = searchParams.get('message') === 'reconnect';
  const redirectParam = searchParams.get('redirect'); // Nouvelle détection de redirect

  const getReturnTo = () => {
    // Priorité au paramètre redirect
    if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
      return redirectParam;
    }
    
    const raw = location?.state?.from;
    if (typeof raw === 'string') {
      if (!raw.startsWith('/') || raw.startsWith('//')) return null;
      return raw;
    }
    // Compat: ProtectedRoute passe parfois un objet location.
    if (raw && typeof raw === 'object' && typeof raw.pathname === 'string') {
      const path = raw.pathname;
      const search = typeof raw.search === 'string' ? raw.search : '';
      if (!path.startsWith('/') || path.startsWith('//')) return null;
      return `${path}${search}`;
    }
    return null;
  };

  const returnTo = getReturnTo();

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
      // Rediriger vers création camion si upgrade pizzaiolo
      if (isPizzaioloUpgrade) {
        navigate('/pro/creer-camion', { replace: true });
      } else {
        navigate(returnTo || '/explore', { replace: true });
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
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await upsertUserProfile(cred.user);
      // Rediriger vers création camion si upgrade pizzaiolo
      if (isPizzaioloUpgrade) {
        navigate('/pro/creer-camion', { replace: true });
      } else {
        navigate(returnTo || '/explore', { replace: true });
      }
    } catch (err) {
      setError(err?.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  // Détection de l'auto-remplissage par gestionnaire de mots de passe
  // pour soumettre automatiquement le formulaire (sans friction)
  useEffect(() => {
    const emailEl = emailRef.current;
    const passwordEl = passwordRef.current;
    const formEl = formRef.current;

    if (!emailEl || !passwordEl) return;

    let autosubmitTimer = null;

    // Gestionnaires de mots de passe déclenchent soit 'animationstart' (Chrome/Edge avec :-webkit-autofill),
    // soit 'input' avec valeur déjà remplie (Firefox, Safari).
    const checkAutofillAndSubmit = () => {
      // Attendre un court instant pour que les deux champs soient remplis
      clearTimeout(autosubmitTimer);
      autosubmitTimer = setTimeout(() => {
        const emailFilled = emailEl.value?.trim().length > 0;
        const passwordFilled = passwordEl.value?.trim().length > 0;

        // Si les deux sont remplis ET qu'on n'est pas déjà en train de charger, soumettre
        if (emailFilled && passwordFilled && !loading && formEl) {
          formEl.requestSubmit();
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

    emailEl.addEventListener('animationstart', handleAnimation);
    passwordEl.addEventListener('animationstart', handleAnimation);
    emailEl.addEventListener('input', handleInput);
    passwordEl.addEventListener('input', handleInput);

    return () => {
      clearTimeout(autosubmitTimer);
      emailEl.removeEventListener('animationstart', handleAnimation);
      passwordEl.removeEventListener('animationstart', handleAnimation);
      emailEl.removeEventListener('input', handleInput);
      passwordEl.removeEventListener('input', handleInput);
    };
  }, [loading]);

  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <BackButton className="mb-4" />
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <CardDescription>
            Pas de compte ?{' '}
            <Link
              to="/register"
              state={returnTo ? { from: returnTo } : undefined}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Créer un compte
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Message de reconnexion après upgrade pizzaiolo */}
          {isPizzaioloUpgrade && shouldShowReconnectMessage && (
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30">
              <p className="text-sm font-semibold text-primary">
                🎉 Votre compte a été transformé en compte pizzaiolo !
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Reconnectez-vous pour accéder à la création de votre camion.
              </p>
            </div>
          )}

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
