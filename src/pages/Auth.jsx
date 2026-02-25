import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  sendEmailVerification
} from 'firebase/auth';
import Card from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { upsertUserProfile } from '../lib/userProfile';
import { useClientProfile } from '../features/users/hooks/useClientProfile';
import { Pizza, Eye, EyeOff } from 'lucide-react';
import PasswordStrengthIndicator from '../components/ui/PasswordStrengthIndicator';
import { isPasswordValid } from '../lib/passwordValidation';
import PhoneInputWithPrefix from '../components/ui/PhoneInputWithPrefix';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Onglet actif: 'login' ou 'register'
  const initialTab = location.pathname.includes('register') ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState(initialTab);

  // États communs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // États inscription
  const [phoneNumber, setPhoneNumber] = useState('');
  const { isClient, loading: profileLoading, createClientProfile } = useClientProfile();

  // États mot de passe oublié
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  // Refs pour autofill
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const formRef = useRef(null);

  // Redirection vers /auth/action si Firebase envoie un lien de reset/verify
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    if (mode === 'resetPassword' || mode === 'verifyEmail') {
      navigate(`/auth/action${location.search}`, { replace: true });
    }
  }, [location.search, navigate]);

  // Rediriger si déjà connecté
  useEffect(() => {
    if (!profileLoading && isClient) {
      navigate('/explore', { replace: true });
    }
  }, [isClient, profileLoading, navigate]);

  // Détection des paramètres
  const isPizzaioloUpgrade = searchParams.get('pizzaiolo') === 'true';
  const shouldShowReconnectMessage = searchParams.get('message') === 'reconnect';
  const redirectParam = searchParams.get('redirect');

  const getReturnTo = () => {
    if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
      return redirectParam;
    }
    const raw = location?.state?.from;
    if (typeof raw === 'string') {
      if (!raw.startsWith('/') || raw.startsWith('//')) return null;
      return raw;
    }
    if (raw && typeof raw === 'object' && typeof raw.pathname === 'string') {
      const path = raw.pathname;
      const search = typeof raw.search === 'string' ? raw.search : '';
      if (!path.startsWith('/') || path.startsWith('//')) return null;
      return `${path}${search}`;
    }
    return null;
  };

  const rawReturnTo = getReturnTo();
  const returnTo = (!isPizzaioloUpgrade && rawReturnTo?.startsWith('/pro/')) ? null : rawReturnTo;

  // Reset error when switching tabs
  useEffect(() => {
    setError('');
  }, [activeTab]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS CONNEXION
  // ═══════════════════════════════════════════════════════════════════════════

  const onLogin = async (e) => {
    e.preventDefault();
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase n\'est pas configuré.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await upsertUserProfile(cred.user);
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

  const onGoogleLogin = async () => {
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase n\'est pas configuré.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      await upsertUserProfile(cred.user);
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

  const onResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError('Entrez votre adresse email.');
      return;
    }
    setResetError('');
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: false,
      };
      await sendPasswordResetEmail(auth, resetEmail.trim(), actionCodeSettings);
      setResetSent(true);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setResetError('Aucun compte trouvé avec cet email.');
      } else {
        setResetError(err?.message || 'Erreur lors de l\'envoi.');
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS INSCRIPTION
  // ═══════════════════════════════════════════════════════════════════════════

  const onRegister = async (e) => {
    e.preventDefault();
    if (!isPasswordValid(password)) {
      setError('Le mot de passe ne remplit pas tous les critères de sécurité.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await sendEmailVerification(userCred.user);
      } catch { /* non bloquant */ }

      await new Promise(resolve => setTimeout(resolve, 500));

      const fullPhone = phoneNumber ? `+33${phoneNumber.replace(/\s/g, '')}` : '';
      const success = await createClientProfile({
        phoneNumber: fullPhone,
        displayName: email.split('@')[0],
      });

      if (!success) {
        throw new Error('Impossible de créer le profil client');
      }

      navigate('/explore');
    } catch (err) {
      console.error('[Auth] Register error:', err);
      setError(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleRegister = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      const fullPhone = phoneNumber ? `+33${phoneNumber.replace(/\s/g, '')}` : '';
      await createClientProfile({
        phoneNumber: fullPhone,
      });

      navigate('/explore');
    } catch (err) {
      console.error('[Auth] Google register error:', err);
      setError(err.message || 'Erreur lors de l\'inscription avec Google');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOFILL DETECTION (login only)
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeTab !== 'login') return;

    const emailEl = emailRef.current;
    const passwordEl = passwordRef.current;
    const formEl = formRef.current;

    if (!emailEl || !passwordEl) return;

    let autosubmitTimer = null;

    const checkAutofillAndSubmit = () => {
      clearTimeout(autosubmitTimer);
      autosubmitTimer = setTimeout(() => {
        const emailFilled = emailEl.value?.trim().length > 0;
        const passwordFilled = passwordEl.value?.trim().length > 0;
        if (emailFilled && passwordFilled && !loading && formEl) {
          formEl.requestSubmit();
        }
      }, 300);
    };

    const handleAnimation = (e) => {
      if (e.animationName === 'onAutoFillStart') {
        checkAutofillAndSubmit();
      }
    };

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
  }, [loading, activeTab]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-4xl max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-5 rounded-3xl bg-orange-500/10 mb-4">
            <Pizza className="h-12 w-12 text-orange-500" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 p-1 bg-gray-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'login'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'register'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Inscription
          </button>
        </div>

        {/* Message de reconnexion après upgrade pizzaiolo */}
        {activeTab === 'login' && isPizzaioloUpgrade && shouldShowReconnectMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30">
            <p className="text-sm font-semibold text-orange-600">
              Votre compte a été transformé en compte pizzaiolo !
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Reconnectez-vous pour accéder à la création de votre camion.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        {!isFirebaseConfigured && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-sm font-medium">
            Firebase n'est pas configuré.
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* FORMULAIRE CONNEXION */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'login' && (
          <>
            <form ref={formRef} onSubmit={onLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Email</label>
                <Input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  autoComplete="email"
                  required
                  className="rounded-2xl h-12"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Mot de passe</label>
                <div className="relative">
                  <Input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="rounded-2xl h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setResetMode(true); setResetEmail(email); }}
                  className="text-xs text-orange-500 hover:text-orange-600 font-bold mt-2"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <Button
                type="submit"
                disabled={loading || !isFirebaseConfigured}
                className="w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </form>

            <div className="mt-6">
              <Button
                type="button"
                onClick={onGoogleLogin}
                disabled={loading || !isFirebaseConfigured}
                variant="outline"
                className="w-full rounded-2xl h-12 font-bold"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuer avec Google
              </Button>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* FORMULAIRE INSCRIPTION */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'register' && (
          <>
            <form onSubmit={onRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  className="rounded-2xl h-12"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Mot de passe</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="rounded-2xl h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={password} />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Téléphone (optionnel)</label>
                <PhoneInputWithPrefix
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  placeholder="6 12 34 56 78"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Format : 06 ou 07 uniquement
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || !isPasswordValid(password)}
                className="w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600"
              >
                {loading ? 'Inscription...' : 'Créer mon compte'}
              </Button>
            </form>

            <div className="mt-6">
              <Button
                type="button"
                onClick={onGoogleRegister}
                disabled={loading}
                variant="outline"
                className="w-full rounded-2xl h-12 font-bold"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuer avec Google
              </Button>
            </div>
          </>
        )}

        {/* Lien espace pro */}
        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Vous êtes pizzaiolo ? </span>
          <button
            type="button"
            onClick={() => navigate('/pro/inscription')}
            className="font-bold text-orange-500 hover:text-orange-600"
          >
            Espace pro
          </button>
        </div>
      </Card>

      {/* Modal mot de passe oublié */}
      {resetMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setResetMode(false)}>
          <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-1">Mot de passe oublié</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Entrez votre email, vous recevrez un lien de réinitialisation.
            </p>

            {resetSent ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-sm font-medium">
                  Email envoyé ! Vérifiez votre boîte de réception.
                </div>
                <Button
                  className="w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600"
                  onClick={() => { setResetMode(false); setResetSent(false); }}
                >
                  Fermer
                </Button>
              </div>
            ) : (
              <form onSubmit={onResetPassword} className="space-y-4">
                <Input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  autoFocus
                  className="rounded-2xl h-12"
                />
                {resetError && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm font-medium">
                    {resetError}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-2xl h-12 font-bold" onClick={() => setResetMode(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="flex-1 rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600">
                    Envoyer
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
