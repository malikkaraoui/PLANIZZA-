import { useState } from 'react';
import { MapPin } from 'lucide-react';
import CityAutocomplete from './CityAutocomplete';

/**
 * LocationSearch
 * Un composant de recherche de lieu "Liquid Glass" unifié.
 * Gère tout seul l'état des bordures arrondies et du glow lors de l'ouverture des suggestions.
 */
export default function LocationSearch({
  value,
  onChange,
  onSelect,
  onSearch,
  placeholder = "Entrez une ville ou un code postal...",
  className = "",
  inputClassName = "",
  variant = "hero", // 'hero' (h-20) ou 'compact' (h-16)
  onOpenChange,
  inputRef,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const isHero = variant === "hero";

  // Rayons de bordures dynamiques
  const borderRadiusClasses = isHero
    ? (isOpen ? 'rounded-t-[28px] rounded-b-[16px]' : 'rounded-[28px]')
    : (isOpen ? 'rounded-t-[24px] rounded-b-[12px]' : 'rounded-[24px]');

  const heightClass = isHero ? 'h-20' : 'h-16';
  const paddingX = isHero ? 'px-6' : 'px-5';

  return (
    <div className={`relative group w-full text-left ${className}`}>
      {/* Glow extérieur (uniquement en hero ou selon envie) */}
      {isHero && (
        <div className="absolute -inset-1 bg-linear-to-r from-primary to-orange-500 rounded-[32px] blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
      )}

      <div
        className={`relative flex items-center ${heightClass} ${paddingX} bg-white/80 border border-white/40 focus-within:ring-8 focus-within:ring-primary/15 focus-within:border-primary/50 transition-all duration-500 shadow-2xl backdrop-blur-3xl hover:border-primary/30 group/input ${borderRadiusClasses}`}
      >
        {/* Glow intérieur sous l'input quand ouvert */}
        {isOpen && (
          <div className={`pointer-events-none absolute left-6 right-6 ${isHero ? 'bottom-[-14px]' : 'bottom-[-10px]'} ${isHero ? 'h-7' : 'h-6'} rounded-full bg-white/60 blur-2xl opacity-70`} />
        )}

        {/* Cône de pin */}
        <div className={`relative z-10 p-2 rounded-xl bg-primary/5 group-hover/input:bg-primary/10 transition-colors duration-500`}>
          <MapPin className={`${isHero ? 'h-6 w-6' : 'h-5 w-5'} text-primary transition-transform group-hover/input:scale-110`} />
        </div>

        {/* Input Autocomplete */}
        <CityAutocomplete
          inputRef={inputRef}
          value={value}
          onChange={onChange}
          onSelect={onSelect}
          onSearch={onSearch}
          placeholder={placeholder}
          className="flex-1 ml-3 h-full"
          inputClassName={`h-full w-full text-foreground selection:bg-primary/20 selection:text-primary caret-primary bg-transparent font-bold tracking-tight ${isHero ? 'text-base sm:text-xl' : 'text-base sm:text-lg'} ${inputClassName}`}
          onOpenChange={handleOpenChange}
        />
      </div>
    </div>
  );
}
