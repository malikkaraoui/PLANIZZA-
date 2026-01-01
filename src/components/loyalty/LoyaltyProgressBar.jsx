import { Gift, TrendingUp } from 'lucide-react';

export default function LoyaltyProgressBar({ points, currentTier, nextTier, progress, maxTierReached }) {
  // Calculer le palier actuel (tous les 10 points = 1 palier)
  const currentLevel = Math.floor(points / 10);
  const nextLevel = currentLevel + 1;
  
  // Points dans le palier actuel (0-10)
  const pointsInCurrentLevel = points % 10;
  const progressPercentage = (pointsInCurrentLevel / 10) * 100;
  
  // Points restants pour le prochain palier
  const pointsToNextLevel = 10 - pointsInCurrentLevel;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-bold text-gray-700">
            Carte de fidélité
          </span>
        </div>
        <span className="text-xs font-medium text-gray-500">
          {points} points
        </span>
      </div>

      {/* Barre de progression */}
      <div className="space-y-1">
        <div className="relative">
          <div 
            className="h-3 bg-gray-200 rounded-full overflow-hidden"
            title={`${pointsInCurrentLevel}/10 points`}
          >
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
        
        {/* Indicateurs 0 et 10 */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-gray-500">0</span>
          <span className="text-[10px] font-bold text-gray-500">10</span>
        </div>
      </div>

      {/* Infos palier */}
      <div className="flex items-start gap-2">
        <div className="text-xs text-gray-600">
          Prochain palier à{' '}
          <span className="font-bold text-orange-500">
            {(nextLevel * 10)} points
          </span>
        </div>
      </div>

      {/* Récompense du palier actuel */}
      {currentTier && (
        <div className="text-xs bg-orange-50 border border-orange-200 rounded-lg p-2 flex items-center gap-2">
          <TrendingUp className="h-3 w-3 text-orange-500 flex-shrink-0" />
          <span className="text-orange-700 font-medium">
            <span className="font-bold">{currentTier.label}</span>
            {' '}débloqué{currentTier.description && ` · ${currentTier.description}`}
          </span>
        </div>
      )}
    </div>
  );
}
