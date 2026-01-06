import { Input } from '../../../../components/ui/Input';

export function PizzaioloMenuDessertCustomizer({
  selectedCategory,
  isCustomMode,
  itemName,
  setItemName,
}) {
  if (selectedCategory !== 'dessert') return null;
  if (!isCustomMode) return null;

  return (
    <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
      <h3 className="text-lg font-semibold text-gray-900">🍰 Personnalisez votre dessert</h3>
      
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
