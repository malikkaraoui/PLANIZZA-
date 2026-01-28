import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Pizza, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import PasswordStrengthIndicator from '../components/ui/PasswordStrengthIndicator';
import { isPasswordValid } from '../lib/passwordValidation';

export default function AuthAction() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  // Verification email
  const [verifyStatus, setVerifyStatus] = useState('loading'); // loading | success | error

  // Reset password
  const [resetStatus, setResetStatus] = useState('idle'); // idle | ready | success | error
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetError, setResetError] = useState('');

  // Verification email : appliquer le code
  useEffect(() => {
    if (mode !== 'verifyEmail' || !oobCode) return;

    applyActionCode(auth, oobCode)
      .then(() => setVerifyStatus('success'))
      .catch(() => setVerifyStatus('error'));
  }, [mode, oobCode]);

  // Reset password : verifier le code et recuperer l'email
  useEffect(() => {
    if (mode !== 'resetPassword' || !oobCode) return;

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setResetEmail(email);
        setResetStatus('ready');
      })
      .catch(() => setResetStatus('error'));
  }, [mode, oobCode]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isPasswordValid(newPassword)) {
      setResetError('Le mot de passe ne remplit pas tous les critères.');
      return;
    }
    setResetError('');
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setResetStatus('success');
    } catch (err) {
      setResetError(err?.message || 'Erreur lors de la réinitialisation.');
    }
  };

  // Pas de mode valide
  if (!mode || !oobCode) {
    return (
      <Shell>
        <StatusIcon status="error" />
        <h1 className="text-2xl font-black text-gray-900 mt-4">Lien invalide</h1>
        <p className="text-gray-500 mt-2">Ce lien est expiré ou invalide.</p>
        <Button className="mt-6 w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600" onClick={() => navigate('/login')}>
          Retour à la connexion
        </Button>
      </Shell>
    );
  }

  // ─── VERIFICATION EMAIL ───
  if (mode === 'verifyEmail') {
    return (
      <Shell>
        {verifyStatus === 'loading' && (
          <>
            <div className="animate-pulse inline-flex p-5 rounded-3xl bg-orange-500/10">
              <Pizza className="h-12 w-12 text-orange-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-4">Vérification en cours...</h1>
          </>
        )}
        {verifyStatus === 'success' && (
          <>
            <StatusIcon status="success" />
            <h1 className="text-2xl font-black text-gray-900 mt-4">Email vérifié !</h1>
            <p className="text-gray-500 mt-2">Votre adresse email a été confirmée avec succès.</p>
            <Button className="mt-6 w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600" onClick={() => navigate('/explore')}>
              Découvrir les camions
            </Button>
          </>
        )}
        {verifyStatus === 'error' && (
          <>
            <StatusIcon status="error" />
            <h1 className="text-2xl font-black text-gray-900 mt-4">Lien expiré</h1>
            <p className="text-gray-500 mt-2">Ce lien de vérification n'est plus valide.</p>
            <Button className="mt-6 w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600" onClick={() => navigate('/login')}>
              Retour à la connexion
            </Button>
          </>
        )}
      </Shell>
    );
  }

  // ─── RESET PASSWORD ───
  if (mode === 'resetPassword') {
    return (
      <Shell>
        {resetStatus === 'idle' && (
          <>
            <div className="animate-pulse inline-flex p-5 rounded-3xl bg-orange-500/10">
              <Pizza className="h-12 w-12 text-orange-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-4">Vérification du lien...</h1>
          </>
        )}

        {resetStatus === 'ready' && (
          <>
            <div className="inline-flex p-5 rounded-3xl bg-orange-500/10">
              <Pizza className="h-12 w-12 text-orange-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-4">Nouveau mot de passe</h1>
            <p className="text-gray-500 mt-2 text-sm">
              Pour le compte <span className="font-semibold text-gray-700">{resetEmail}</span>
            </p>

            <form onSubmit={handleResetPassword} className="mt-6 w-full space-y-4 text-left">
              <div>
                <label className="block text-sm font-bold mb-2">Nouveau mot de passe</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="rounded-2xl h-12 pr-12"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={newPassword} />
              </div>

              {resetError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 font-medium">
                  {resetError}
                </div>
              )}

              <Button
                type="submit"
                disabled={!isPasswordValid(newPassword)}
                className="w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600"
              >
                Réinitialiser le mot de passe
              </Button>
            </form>
          </>
        )}

        {resetStatus === 'success' && (
          <>
            <StatusIcon status="success" />
            <h1 className="text-2xl font-black text-gray-900 mt-4">Mot de passe modifié !</h1>
            <p className="text-gray-500 mt-2">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
            <Button className="mt-6 w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600" onClick={() => navigate('/login')}>
              Se connecter
            </Button>
          </>
        )}

        {resetStatus === 'error' && (
          <>
            <StatusIcon status="error" />
            <h1 className="text-2xl font-black text-gray-900 mt-4">Lien expiré</h1>
            <p className="text-gray-500 mt-2">Ce lien de réinitialisation n'est plus valide. Demandez-en un nouveau.</p>
            <Button className="mt-6 w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600" onClick={() => navigate('/login')}>
              Retour à la connexion
            </Button>
          </>
        )}
      </Shell>
    );
  }

  // Mode inconnu
  return (
    <Shell>
      <StatusIcon status="error" />
      <h1 className="text-2xl font-black text-gray-900 mt-4">Action inconnue</h1>
      <Button className="mt-6 w-full rounded-2xl h-12 font-bold bg-orange-500 hover:bg-orange-600" onClick={() => navigate('/login')}>
        Retour à la connexion
      </Button>
    </Shell>
  );
}

// ─── Composants internes ───

function Shell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="bg-white border border-gray-200 shadow-sm rounded-3xl p-8 max-w-md w-full text-center">
        {children}
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'success') {
    return (
      <div className="inline-flex p-5 rounded-3xl bg-emerald-500/10">
        <CheckCircle className="h-12 w-12 text-emerald-500" />
      </div>
    );
  }
  return (
    <div className="inline-flex p-5 rounded-3xl bg-red-500/10">
      <XCircle className="h-12 w-12 text-red-500" />
    </div>
  );
}
