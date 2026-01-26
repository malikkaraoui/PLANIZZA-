import { Heart } from 'lucide-react';
import { useFavorite } from '../../features/trucks/hooks/useFavorites';
import { cn } from '../../lib/utils';

/**
 * Bouton favoris (coeur) pour un camion
 * Différent des étoiles de notation - c'est un coeur pour "j'aime"
 */
export function FavoriteButton({ truckId, truckName, className, size = 'md' }) {
  const { isFavorite, toggle, loading } = useFavorite(truckId, truckName);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) {
      toggle();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'flex items-center justify-center rounded-full transition-all duration-300',
        'bg-white/80 dark:bg-black/50 backdrop-blur-sm',
        'border border-white/30 dark:border-white/10',
        'hover:scale-110 hover:shadow-lg active:scale-95',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        className
      )}
      aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <Heart
        className={cn(
          iconSizes[size],
          'transition-all duration-300',
          isFavorite
            ? 'text-red-500 fill-red-500 scale-110'
            : 'text-gray-400 hover:text-red-400'
        )}
      />
    </button>
  );
}

export default FavoriteButton;
