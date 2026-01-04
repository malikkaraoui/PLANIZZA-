import { PIZZAS_PREDEFINES } from '../../constants';

export function PizzaioloMenuPizzaPresetGrid({ selectedCategory, itemName, onSelectPizza }) {
  if (selectedCategory !== 'pizza' || itemName) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Choisissez une pizza</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {PIZZAS_PREDEFINES.map((pizza) => (
          <button
            key={pizza.name}
            type="button"
            onClick={() => onSelectPizza(pizza)}
            className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
          >
            <div className="text-3xl mb-2">{pizza.emoji}</div>
            <div className="font-semibold text-sm">{pizza.name}</div>
            {pizza.ingredients && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{pizza.ingredients}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
