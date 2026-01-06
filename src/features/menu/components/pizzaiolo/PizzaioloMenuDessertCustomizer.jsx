export function PizzaioloMenuDessertCustomizer({
  selectedCategory,
  isCustomMode,
}) {
  if (selectedCategory !== 'dessert') return null;
  if (!isCustomMode) return null;

  return (
    <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
      <h3 className="text-lg font-semibold text-gray-900">🍰 Personnalisez votre dessert</h3>
      
      <div className="text-xs text-gray-600 mb-2">
        💡 Donnez un nom à votre dessert personnalisé. Vous définirez le prix ci-dessous.
      </div>
    </div>
  );
}
