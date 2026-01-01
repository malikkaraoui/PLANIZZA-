import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../../lib/firebase';
import { useCart } from './hooks/useCart';
import { Button } from '../../components/ui/Button';
import { Coffee, Wind } from 'lucide-react';

export default function PausedTruckWatcher() {
  const { items, clear, truckId } = useCart();
  const [showMessage, setShowMessage] = useState(false);
  const [truckName, setTruckName] = useState('');
  const [messageIndex] = useState(() => Math.floor(Math.random() * 4));
  const [previousPausedState, setPreviousPausedState] = useState(false);

  const messages = [
    "prend un instant pour s'hydrater 💧",
    "prend un bol d'air frais 🌬️",
    "s'accorde une pause bien méritée ☕",
    "fait une petite pause détente 🧘"
  ];

  const randomMessage = messages[messageIndex];

  useEffect(() => {
    if (!truckId) return;

    const truckRef = ref(db, `public/trucks/${truckId}`);

    const unsubscribe = onValue(truckRef, (snapshot) => {
      if (snapshot.exists()) {
        const truck = snapshot.val();
        const isPaused = truck.isPaused === true;
        
        setTruckName(truck.name || 'Votre pizzaiolo');

        // Détecter le passage en pause (transition false -> true)
        if (isPaused && !previousPausedState) {
          // Le camion vient de passer en pause
          if (items && items.length > 0) {
            console.log('[PausedTruckWatcher] Camion passé en pause, vidage du panier:', items.length, 'items');
            clear();
            setShowMessage(true);
          }
        }
        
        // Mettre à jour l'état précédent
        setPreviousPausedState(isPaused);
      }
    });

    return () => off(truckRef, 'value', unsubscribe);
  }, [truckId, clear, items, previousPausedState]);

  if (!showMessage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-premium glass-glossy border-white/30 rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-6">
          {/* Icône animée */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 animate-bounce">
            {randomMessage.includes('air') ? (
              <Wind className="h-10 w-10 text-primary" />
            ) : (
              <Coffee className="h-10 w-10 text-primary" />
            )}
          </div>

          {/* Titre */}
          <h2 className="text-2xl font-black tracking-tight text-premium-gradient">
            Petite pause ! ☕
          </h2>

          {/* Message */}
          <p className="text-lg font-medium text-muted-foreground leading-relaxed">
            <span className="font-bold text-primary">{truckName}</span> {randomMessage}
          </p>

          <p className="text-sm text-muted-foreground">
            Votre panier a été vidé. Revenez dans quelques instants ! 
          </p>

          {/* Bouton */}
          <Button
            onClick={() => setShowMessage(false)}
            className="w-full rounded-2xl h-12 font-black text-base"
          >
            J'ai compris ! 👍
          </Button>
        </div>
      </div>
    </div>
  );
}
