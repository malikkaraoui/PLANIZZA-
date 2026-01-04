import { BASES, FROMAGES, GARNITURES } from '../../constants';

export function PizzaioloMenuPizzaCustomizer({
  itemName,
  selectedBase,
  setSelectedBase,
  selectedGarnitures,
  setSelectedGarnitures,
  selectedFromages,
  setSelectedFromages,
}) {
  if (itemName !== 'La Perso') return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Composez votre pizza</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Base *</label>
        <div className="grid grid-cols-2 gap-3">
          {BASES.map((base) => (
            <button
              key={base}
              type="button"
              onClick={() => setSelectedBase(base)}
              className={`p-3 rounded-lg border-2 transition-all text-sm ${
                selectedBase === base
                  ? 'border-emerald-500 bg-emerald-50 font-semibold'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {base}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Garnitures</label>
        <div className="grid grid-cols-2 gap-2">
          {GARNITURES.map((garniture) => (
            <button
              key={garniture}
              type="button"
              onClick={() => {
                setSelectedGarnitures((prev) =>
                  prev.includes(garniture) ? prev.filter((g) => g !== garniture) : [...prev, garniture]
                );
              }}
              className={`p-2 rounded-lg border-2 transition-all text-xs ${
                selectedGarnitures.includes(garniture)
                  ? 'border-emerald-500 bg-emerald-50 font-semibold'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {garniture}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Fromages *</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {FROMAGES.map((fromage) => (
            <button
              key={fromage}
              type="button"
              onClick={() => {
                setSelectedFromages((prev) =>
                  prev.includes(fromage) ? prev.filter((f) => f !== fromage) : [...prev, fromage]
                );
              }}
              className={`p-2 rounded-lg border-2 transition-all text-xs ${
                selectedFromages.includes(fromage)
                  ? 'border-emerald-500 bg-emerald-50 font-semibold'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {fromage}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
