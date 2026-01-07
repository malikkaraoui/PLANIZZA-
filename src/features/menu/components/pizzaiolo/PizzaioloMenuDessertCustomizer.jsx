import { Input } from '../../../../components/ui/Input';

export function PizzaioloMenuDessertCustomizer({
  selectedCategory,
  isCustomMode,
  onExitCustom,
  itemName,
  setItemName,
}) {
  if (selectedCategory !== 'dessert') return null;
  if (!isCustomMode) return null;

  return (
    <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">🍰 Personnalisez votre dessert</h3>
        {typeof onExitCustom === 'function' && (
          <button
            type="button"
            onClick={() => onExitCustom()}
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            title="Revenir à la liste des desserts"
          >
            ← Retour à la liste
          </button>
        )}
      </div>
      
      {/* Nom du dessert */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nom du dessert
        </label>
        <Input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="Ex: Mon Tiramisu maison..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Vous pouvez garder "Autre" ou personnaliser le nom
        </p>
      </div>
      
      <div className="text-xs text-gray-600">
        💡 Définissez le prix ci-dessous pour finaliser votre dessert.
      </div>
    </div>
  );
}
