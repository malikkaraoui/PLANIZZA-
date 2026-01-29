import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendEmailVerification } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useClientProfile } from '../features/users/hooks/useClientProfile';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import Card from '../components/ui/Card';
import PhoneInputWithPrefix from '../components/ui/PhoneInputWithPrefix';
import { Pizza, Eye, EyeOff } from 'lucide-react';
import PasswordStrengthIndicator from '../components/ui/PasswordStrengthIndicator';
import { isPasswordValid } from '../lib/passwordValidation';

export default function RegisterClient() {
  const navigate = useNavigate();
  const { isClient, loading: profileLoading, createClientProfile } = useClientProfile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Rediriger si déjà client
  useEffect(() => {
    if (!profileLoading && isClient) {
      navigate('/explore', { replace: true });
    }
  }, [isClient, profileLoading, navigate]);

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    if (!isPasswordValid(password)) {
      setError('Le mot de passe ne remplit pas tous les critères de sécurité.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // 1. Créer le compte Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      // Envoyer l'email de vérification
      try {
        await sendEmailVerification(userCred.user);
      } catch { /* non bloquant */ }
      
      // 2. Attendre que Firebase Auth soit complètement initialisé
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 3. Créer le profil client dans RTDB avec le numéro formaté complet
      const fullPhone = phoneNumber ? `+33${phoneNumber.replace(/\s/g, '')}` : '';
      const success = await createClientProfile({
        phoneNumber: fullPhone,
        displayName: email.split('@')[0], // Nom par défaut
      });

      if (!success) {
        throw new Error('Impossible de créer le profil client');
      }

      // 4. Rediriger vers l'exploration
      navigate('/explore');
    } catch (err) {
      console.error('[RegisterClient] Error:', err);
      setError(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      
      // Créer le profil client avec le numéro formaté complet
      const fullPhone = phoneNumber ? `+33${phoneNumber.replace(/\s/g, '')}` : '';
      await createClientProfile({
        phoneNumber: fullPhone,
      });

      navigate('/explore');
    } catch (err) {
      console.error('[RegisterClient] Google error:', err);
      setError(err.message || 'Erreur lors de l\'inscription avec Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-4xl max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex p-6 rounded-3xl bg-orange-500/10 mb-4">
            <Pizza className="h-16 w-16 text-orange-500" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Créer un compte</h1>
          <p className="mt-2 text-muted-foreground font-medium">
            Commandez vos pizzas préférées
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailRegister} className="space-y-4">
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
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
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
            onClick={handleGoogleRegister}
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

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Vous êtes pizzaiolo ? </span>
          <button
            type="button"
            onClick={() => navigate('/pro/inscription')}
            className="font-bold text-orange-500 hover:text-orange-600"
          >
            Créer un compte pro
          </button>
        </div>

        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">Déjà un compte ? </span>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-bold text-orange-500 hover:text-orange-600"
          >
            Se connecter
          </button>
        </div>
      </Card>
    </div>
  );
}
