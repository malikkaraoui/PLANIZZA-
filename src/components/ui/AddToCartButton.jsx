import { Check, Plus } from 'lucide-react';

/**
 * Bouton d'ajout au panier — logique unifiee pour tout le menu.
 *
 * Taille fixe, pas d'animation de redimensionnement.
 * - Compact (defaut) : petit bouton rond "+"
 * - Full : bouton avec texte "+ AJOUTER"
 * - justAdded : feedback vert avec check
 *
 * Couleur : blanc/orange au repos, orange plein au hover, vert au justAdded.
 */
export default function AddToCartButton({
  onClick,
  disabled = false,
  justAdded = false,
  variant = 'compact',
  className = '',
  label = 'Ajouter',
  addedLabel = 'Ajouté',
  ...props
}) {
  const isCompact = variant === 'compact';

  // Classes de base communes
  const base =
    'inline-flex items-center justify-center rounded-full font-black uppercase tracking-widest ' +
    'transition-colors duration-200 select-none ' +
    'disabled:opacity-40 disabled:cursor-not-allowed';

  // Taille selon variant
  const sizeClasses = isCompact
    ? 'h-8 w-8 text-[10px]'
    : 'h-10 px-5 gap-2 text-[10px]';

  // Couleurs selon etat
  let colorClasses;
  if (justAdded) {
    colorClasses =
      'bg-emerald-500 text-white border border-emerald-500 shadow-sm';
  } else {
    colorClasses =
      'bg-white text-orange-500 border border-orange-400/50 shadow-sm ' +
      'hover:bg-orange-500 hover:text-white hover:border-orange-500';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={justAdded ? addedLabel : label}
      className={`${base} ${sizeClasses} ${colorClasses} ${className}`}
      {...props}
    >
      {justAdded ? (
        <Check className="h-4 w-4" />
      ) : (
        <>
          <Plus className={isCompact ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
          {!isCompact && <span>{label}</span>}
        </>
      )}
    </button>
  );
}
