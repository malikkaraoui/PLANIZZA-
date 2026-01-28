import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { PIZZA_PHOTO_PRESETS } from '../../constants/pizzaPhotoPresets';

/**
 * Carrousel de sélection de photo de pizza pour le formulaire pizzaiolo
 */
export default function PizzaPhotoCarousel({ selectedPhotoUrl, onSelectPhoto }) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef(null);
  
  const scroll = (direction) => {
    if (!containerRef.current) return;
    
    const scrollAmount = 320; // largeur d'une carte + gap
    const newPosition = direction === 'left' 
      ? Math.max(0, scrollPosition - scrollAmount)
      : scrollPosition + scrollAmount;
    
    containerRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    
    setScrollPosition(newPosition);
  };
  
  const handleScroll = () => {
    if (containerRef.current) {
      setScrollPosition(containerRef.current.scrollLeft);
    }
  };
  
  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = containerRef.current 
    ? scrollPosition < containerRef.current.scrollWidth - containerRef.current.clientWidth - 10
    : true;
  
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-gray-700">
          Photo de la pizza
          <span className="ml-2 text-xs font-normal text-gray-500">(optionnel)</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Défiler vers la gauche"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Défiler vers la droite"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
      
      <p className="text-xs text-gray-600">
        Choisissez une photo prédéfinie ou téléchargez la vôtre plus tard
      </p>
      
      <div 
        ref={containerRef}
        className="overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex gap-3 min-w-min">
          {/* Option "Aucune photo" */}
          <button
            type="button"
            onClick={() => onSelectPhoto(null)}
            className={`shrink-0 w-32 h-32 rounded-2xl border-2 transition-all hover:scale-105 flex items-center justify-center ${
              !selectedPhotoUrl 
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/20' 
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className="text-center p-3">
              <div className="text-3xl mb-1">📷</div>
              <div className="text-xs font-medium text-gray-600">Sans photo</div>
            </div>
            {!selectedPhotoUrl && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </button>
          
          {/* Photos prédéfinies */}
          {PIZZA_PHOTO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPhoto(preset.url)}
              className={`relative shrink-0 w-32 h-32 rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 ${
                selectedPhotoUrl === preset.url 
                  ? 'border-primary shadow-lg shadow-primary/20' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <img
                src={preset.url}
                alt={preset.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {selectedPhotoUrl === preset.url && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
                <div className="text-[10px] font-medium text-white line-clamp-1">
                  {preset.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
