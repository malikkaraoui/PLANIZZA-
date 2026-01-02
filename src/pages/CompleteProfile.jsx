import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { ref, update, get } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../app/providers/AuthProvider';
import { auth, db } from '../lib/firebase';
import { UserCircle } from 'lucide-react';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const loadProfile = async () => {
      try {
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        
        if (snap.exists()) {
          const data = snap.val();
          
          // Pré-remplir les champs si les données existent
          if (data.displayName) {
            const names = data.displayName.split(' ');
            setFirstName(names[0] || '');
            setLastName(names.slice(1).join(' ') || '');
            setIsEditing(true);
          }
          
          if (data.phoneNumber) {
            setPhoneNumber(data.phoneNumber);
          }
        }
      } catch (err) {
        console.error('[PLANIZZA] Erreur chargement profil:', err);
      }
    };

    loadProfile();
  }, [user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const displayName = `${firstName} ${lastName}`.trim();
      
      // Mettre à jour le profil Firebase Auth
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
      }

      // Mettre à jour le profil dans RTDB
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, {
        displayName,
        phoneNumber,
        updatedAt: Date.now(),
      });

      // Rediriger vers le dashboard si c'est une modification, sinon vers explore
      if (isEditing) {
        navigate('/dashboard');
      } else {
        navigate('/explore');
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {isEditing ? 'Modifier mon profil' : 'Complétez votre profil'}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {isEditing 
              ? 'Modifiez vos informations personnelles.'
              : 'Pour finaliser votre inscription, nous avons besoin de quelques informations supplémentaires.'}
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Prénom <span className="text-red-500">*</span>
              </label>
              <Input 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)} 
                placeholder="Jean"
                required 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Nom <span className="text-red-500">*</span>
              </label>
              <Input 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)} 
                placeholder="Dupont"
                required 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Numéro de téléphone <span className="text-red-500">*</span>
              </label>
              <Input 
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)} 
                type="tel"
                placeholder="06 12 34 56 78"
                required 
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button className="w-full" type="submit" disabled={loading}>
              <UserCircle className="mr-2 h-4 w-4" />
              {loading ? 'Enregistrement…' : 'Valider mon profil'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
