import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useClientProfile } from '../../features/users/hooks/useClientProfile';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { Pizza } from 'lucide-react';

export default function RegisterClient() {
  const navigate = useNavigate();
  const { createClientProfile } = useClientProfile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Créer le compte Firebase Auth
      await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Créer le profil client dans RTDB
      await createClientProfile({
        phoneNumber: phoneNumber || '',
        displayName: email.split('@')[0], // Nom par défaut
      });

      // 3. Rediriger vers l'exploration
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
      
      // Créer le profil client
      await createClientProfile({
        phoneNumber: phoneNumber || '',
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
      <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px] max-w-md w-full">
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
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="rounded-2xl h-12"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Téléphone (optionnel)</label>
            <Input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              className="rounded-2xl h-12"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600"
          >
            {loading ? 'Inscription...' : 'Créer mon compte'}
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-black/20 text-muted-foreground font-medium">ou</span>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleGoogleRegister}
            disabled={loading}
            variant="outline"
            className="w-full mt-4 rounded-2xl h-12 font-bold"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
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
