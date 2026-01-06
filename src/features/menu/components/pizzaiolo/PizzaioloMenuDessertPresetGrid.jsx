import { DESSERTS } from '../../constants';

export function PizzaioloMenuDessertPresetGrid({ selectedCategory, itemName, onSelectDessert }) {
  if (selectedCategory !== 'dessert') return null;
  if (itemName) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Choisissez un dessert</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {DESSERTS.map((dessert) => (
          <button
            key={dessert.name}
            type="button"
            onClick={() => onSelectDessert(dessert)}
            className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center"
          >
            <div className="text-4xl mb-2">{dessert.emoji}</div>
            <div className="font-semibold text-sm">{dessert.name}</div>
            {dessert.defaultPrice && <div className="text-xs text-emerald-600 mt-1">{dessert.defaultPrice.toFixed(2)}€</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
