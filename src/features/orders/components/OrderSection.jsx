import { Badge } from '../../../components/ui/Badge';

/**
 * OrderSection - Composant de section de commandes avec en-tête visuel
 * 
 * @param {Object} props
 * @param {string} props.title - Titre de la section
 * @param {number} props.count - Nombre de commandes dans la section
 * @param {string} props.color - Couleur du thème (orange-500, green-500, blue-500, etc.)
 * @param {React.ReactNode} props.children - Contenu de la section (liste de OrderCard)
 */
export function OrderSection({ title, count, color = 'orange-500', children }) {
  console.log('[OrderSection] Render', { title, count, color });

  if (count === 0) {
    console.log('[OrderSection] Section vide, masquée', title);
    return null;
  }

  return (
    <div className="space-y-4">
      {/* En-tête de section */}
      <div className="flex items-center gap-3">
        <div className={`h-1 w-12 bg-${color} rounded-full`}></div>
        <h3 className={`text-lg font-black text-${color} uppercase tracking-wide`}>
          {title}
        </h3>
        <div className={`h-1 flex-1 bg-${color}/20 rounded-full`}></div>
        <Badge className={`bg-${color} text-white rounded-full font-bold`}>
          {count}
        </Badge>
      </div>
      
      {/* Contenu de la section */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {children}
      </div>
    </div>
  );
}
