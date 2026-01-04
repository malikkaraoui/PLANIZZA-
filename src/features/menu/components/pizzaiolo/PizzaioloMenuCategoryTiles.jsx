export function PizzaioloMenuCategoryTiles({ selectedCategory, onSelect }) {
  return (
    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      <button
        type="button"
        onClick={() => onSelect('pizza')}
        className={`group relative overflow-hidden rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 ${
          selectedCategory === 'pizza'
            ? 'bg-linear-to-br from-orange-600 to-red-700 ring-4 ring-orange-300'
            : 'bg-linear-to-br from-orange-500 to-red-600'
        }`}
      >
        <div className="text-5xl mb-3">🍕</div>
        <h3 className="text-xl font-bold">PIZZA</h3>
        <p className="text-sm text-white/80 mt-1">Créer une pizza</p>
      </button>

      <button
        type="button"
        onClick={() => onSelect('calzone')}
        className={`group relative overflow-hidden rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 ${
          selectedCategory === 'calzone'
            ? 'bg-linear-to-br from-amber-600 to-orange-700 ring-4 ring-amber-300'
            : 'bg-linear-to-br from-amber-500 to-orange-600'
        }`}
      >
        <div className="text-5xl mb-3">🥟</div>
        <h3 className="text-xl font-bold">CALZONE</h3>
        <p className="text-sm text-white/80 mt-1">Ajouter un calzone</p>
      </button>

      <button
        type="button"
        onClick={() => onSelect('boisson')}
        className={`group relative overflow-hidden rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 ${
          selectedCategory === 'boisson'
            ? 'bg-linear-to-br from-blue-600 to-cyan-700 ring-4 ring-blue-300'
            : 'bg-linear-to-br from-blue-500 to-cyan-600'
        }`}
      >
        <div className="text-5xl mb-3">🥤</div>
        <h3 className="text-xl font-bold">BOISSONS</h3>
        <p className="text-sm text-white/80 mt-1">Sodas, eaux, bières...</p>
      </button>

      <button
        type="button"
        onClick={() => onSelect('dessert')}
        className={`group relative overflow-hidden rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 ${
          selectedCategory === 'dessert'
            ? 'bg-linear-to-br from-pink-600 to-purple-700 ring-4 ring-pink-300'
            : 'bg-linear-to-br from-pink-500 to-purple-600'
        }`}
      >
        <div className="text-5xl mb-3">🍰</div>
        <h3 className="text-xl font-bold">DESSERT</h3>
        <p className="text-sm text-white/80 mt-1">Ajouter un dessert</p>
      </button>
    </div>
  );
}
