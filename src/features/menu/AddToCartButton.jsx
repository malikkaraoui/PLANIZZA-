import { Check, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';

function getClassesForMode({ mode, size }) {
  // IMPORTANT: classes statiques (pas de concat dynamique type `w-${x}`), pour éviter les surprises Tailwind.
  if (mode === 'compactHover') {
    return {
      button:
        'group h-9 w-9 px-0 rounded-full shadow-lg transition-all duration-300 font-black text-[9px] tracking-widest uppercase overflow-hidden ' +
        'disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-0 ' +
        'sm:group-hover:justify-start sm:group-hover:gap-2 sm:group-hover:w-28 sm:group-hover:px-4 ' +
        'focus-visible:justify-start focus-visible:gap-2 focus-visible:w-28 focus-visible:px-4',
      icon: 'h-3.5 w-3.5',
      // Important: ne pas utiliser group-focus-within (un clic souris met le focus sur le bouton et fait "coller" le label)
      // On autorise le label uniquement au hover (desktop) et au focus clavier (focus-visible).
      label: 'hidden sm:group-hover:inline group-focus-visible:inline whitespace-nowrap',
    };
  }

  // expanded (déplié partout, ex: pizza ouverte)
  switch (size) {
    case 'lg':
      return {
        button:
          'h-14 px-8 rounded-full shadow-xl transition-all font-black text-xs tracking-widest uppercase gap-3 ' +
          'disabled:opacity-50 disabled:cursor-not-allowed',
        icon: 'h-4 w-4',
        label: 'inline whitespace-nowrap',
      };

    case 'sm':
    default:
      return {
        button:
          'h-10 px-4 rounded-full shadow-lg transition-all font-black text-[10px] tracking-widest uppercase gap-2 ' +
          'disabled:opacity-50 disabled:cursor-not-allowed',
        icon: 'h-4 w-4',
        label: 'inline whitespace-nowrap',
      };
  }
}

/**
 * Bouton d'ajout AU PANIER — tronc commun.
 *
 * Modes:
 * - compactHover: n'affiche que "+"; au hover de la tuile (group-hover) il s'étend et affiche "Ajouter".
 * - expanded: toujours déplié (même rendu que l'état hover), utilisé dans la vue détaillée (pizza ouverte).
 */
export default function AddToCartButton({
  onClick,
  disabled,
  justAdded,
  mode = 'compactHover',
  size = 'sm',
  className = '',
  ariaLabel,
  addedLabel = 'Ajouté',
  label = 'Ajouter',
  ...props
}) {
  const ui = getClassesForMode({ mode, size });

  const stateClasses = justAdded
    ? 'bg-linear-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 border-orange-600'
    : 'bg-white hover:bg-orange-50 text-orange-600 border border-orange-500/40 hover:border-orange-500/70 shadow-md hover:shadow-orange-500/20';

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || (justAdded ? `${addedLabel} au panier` : `${label} au panier`)}
      className={`${ui.button} ${stateClasses} ${className}`}
      {...props}
    >
      {justAdded ? <Check className={ui.icon} /> : <Plus className={ui.icon} />}
      <span className={ui.label}>{justAdded ? addedLabel : label}</span>
    </Button>
  );
}
