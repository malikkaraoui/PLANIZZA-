import { CALZONES_PREDEFINES } from '../../constants';

export function PizzaioloMenuCalzonePresetGrid({ selectedCategory, itemName, hasStartedTyping, onSelectCalzone }) {
  // Afficher la grille seulement si:
  // 1. On est en catégorie calzone
  // 2. L'utilisateur n'a pas encore commencé à taper ou sélectionner
  if (selectedCategory !== 'calzone') return null;
  if (hasStartedTyping || itemName) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Choisissez une calzone</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CALZONES_PREDEFINES.map((calzone) => (
          <button
            key={calzone.name}
            type="button"
            onClick={() => onSelectCalzone(calzone)}
            className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
          >
            <div className="text-3xl mb-2">{calzone.emoji}</div>
            <div className="font-semibold text-sm">{calzone.name}</div>
            {calzone.ingredients && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{calzone.ingredients}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
