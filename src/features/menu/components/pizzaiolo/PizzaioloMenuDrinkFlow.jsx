import { BIERES, DRINK_SIZES, EAUX, SODAS, VINS } from '../../constants';

export function PizzaioloMenuDrinkTypeSelector({ show, itemType, onSelectType }) {
  if (!show) return null;

  return (
    <div className="mt-6 space-y-4 border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-900">Type de boisson</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onSelectType('soda')}
          className={`p-4 rounded-xl border-2 transition-all ${
            itemType === 'soda' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-3xl mb-2">🥤</div>
          <div className="font-medium">Soda</div>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('eau')}
          className={`p-4 rounded-xl border-2 transition-all ${
            itemType === 'eau' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-3xl mb-2">💧</div>
          <div className="font-medium">Eau</div>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('biere')}
          className={`p-4 rounded-xl border-2 transition-all ${
            itemType === 'biere' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-3xl mb-2">🍺</div>
          <div className="font-medium">Bière</div>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('vin')}
          className={`p-4 rounded-xl border-2 transition-all ${
            itemType === 'vin' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-3xl mb-2">🍷</div>
          <div className="font-medium">Vin</div>
        </button>
      </div>
    </div>
  );
}

export function PizzaioloMenuDrinkPicker({
  selectedCategory,
  itemType,
  itemName,
  selectedDrinkSize,
  setItemName,
  setDrinkSizes,
  setSelectedDrinkSize,
  setPriceS,
}) {
  if (selectedCategory !== 'boisson') return null;

  const showChooseDrink = Boolean(itemType) && !itemName && !selectedDrinkSize;
  const showChooseSize = ['soda', 'eau', 'biere'].includes(itemType) && itemName && !selectedDrinkSize;

  return (
    <>
      {showChooseDrink && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {itemType === 'soda' && 'Choisissez un soda'}
            {itemType === 'eau' && 'Choisissez une eau'}
            {itemType === 'biere' && 'Choisissez une bière'}
            {itemType === 'vin' && 'Choisissez un vin'}
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {itemType === 'soda' &&
              SODAS.map((soda) => (
                <button
                  key={soda.name}
                  type="button"
                  onClick={() => {
                    setItemName(soda.name);
                    const defaultSizes = {};
                    DRINK_SIZES.soda.forEach((size) => {
                      defaultSizes[size.value] = size.defaultPrice.toString();
                    });
                    setDrinkSizes(defaultSizes);
                  }}
                  className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center"
                >
                  <div className="text-4xl mb-2">{soda.emoji}</div>
                  <div className="font-semibold text-sm">{soda.name}</div>
                </button>
              ))}

            {itemType === 'eau' &&
              EAUX.map((eau) => (
                <button
                  key={eau.name}
                  type="button"
                  onClick={() => {
                    setItemName(eau.name);
                    const defaultSizes = {};
                    DRINK_SIZES.eau.forEach((size) => {
                      defaultSizes[size.value] = size.defaultPrice.toString();
                    });
                    setDrinkSizes(defaultSizes);
                  }}
                  className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center"
                >
                  <div className="text-4xl mb-2">{eau.emoji}</div>
                  <div className="font-semibold text-sm">{eau.name}</div>
                </button>
              ))}

            {itemType === 'biere' &&
              BIERES.map((biere) => (
                <button
                  key={biere.name}
                  type="button"
                  onClick={() => {
                    setItemName(biere.name);
                    const defaultSizes = {};
                    DRINK_SIZES.biere.forEach((size) => {
                      defaultSizes[size.value] = size.defaultPrice.toString();
                    });
                    setDrinkSizes(defaultSizes);
                  }}
                  className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center"
                >
                  <div className="text-4xl mb-2">{biere.emoji}</div>
                  <div className="font-semibold text-sm">{biere.name}</div>
                </button>
              ))}

            {itemType === 'vin' &&
              VINS.map((vin) => (
                <button
                  key={vin.name}
                  type="button"
                  onClick={() => {
                    setItemName(vin.name);
                    setPriceS(vin.defaultPrice.toString());
                  }}
                  className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
                >
                  <div className="text-3xl mb-2">{vin.emoji}</div>
                  <div className="font-semibold text-xs">{vin.name}</div>
                  <div className="text-xs text-emerald-600 mt-1">{vin.defaultPrice.toFixed(2)}€</div>
                </button>
              ))}
          </div>
        </div>
      )}

      {showChooseSize && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Choisissez la taille à ajouter</h3>
          <div className="grid grid-cols-2 gap-4">
            {DRINK_SIZES[itemType]?.map((size) => (
              <button
                key={size.value}
                type="button"
                onClick={() => {
                  setSelectedDrinkSize(size.value);
                  setDrinkSizes({ [size.value]: size.defaultPrice.toString() });
                }}
                className="p-6 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center"
              >
                <div className="text-2xl font-bold text-gray-900 mb-2">{size.label}</div>
                <div className="text-lg text-emerald-600 font-semibold">{size.defaultPrice.toFixed(2)}€</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
