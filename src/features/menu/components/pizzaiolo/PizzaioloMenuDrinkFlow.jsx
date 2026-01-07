import { useState } from 'react';
import { Input } from '../../../../components/ui/Input';
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
  priceS,
  drinkSizes,
  setItemName,
  setDrinkSizes,
  setSelectedDrinkSize,
  setPriceS,
}) {
  const [customMode, setCustomMode] = useState(false);
  const [customVolume, setCustomVolume] = useState('');

  if (selectedCategory !== 'boisson') return null;

  const showChooseDrink = Boolean(itemType) && !itemName && !selectedDrinkSize && !customMode;
  const showChooseSize = ['soda', 'eau', 'biere'].includes(itemType) && Boolean(itemName) && !selectedDrinkSize && !customMode;

  const isSizedDrink = ['soda', 'eau', 'biere'].includes(itemType);
  const customModeActive = customMode && !showChooseDrink;

  const sizeOptions = isSizedDrink ? DRINK_SIZES[itemType] || [] : [];
  const selectedSizeLabel =
    sizeOptions.find((s) => s.value === selectedDrinkSize)?.label || selectedDrinkSize || '—';

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
                    if (soda.custom) {
                      // Mode "Autre": on affiche tout d'un coup (nom + volume + prix)
                      setCustomMode(true);
                      setCustomVolume('');
                      setItemName('');

                      const defaultSize = DRINK_SIZES.soda?.[0]?.value || '';
                      setSelectedDrinkSize(defaultSize);
                      setDrinkSizes(defaultSize ? { [defaultSize]: '' } : {});
                      return;
                    }

                    setCustomMode(false);
                    setCustomVolume('');
                    setItemName(soda.name);
                    setSelectedDrinkSize('');

                    {
                      const defaultSizes = {};
                      DRINK_SIZES.soda.forEach((size) => {
                        defaultSizes[size.value] = size.defaultPrice.toString();
                      });
                      setDrinkSizes(defaultSizes);
                    }
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
                    if (eau.custom) {
                      setCustomMode(true);
                      setCustomVolume('');
                      setItemName('');

                      const defaultSize = DRINK_SIZES.eau?.[0]?.value || '';
                      setSelectedDrinkSize(defaultSize);
                      setDrinkSizes(defaultSize ? { [defaultSize]: '' } : {});
                      return;
                    }

                    setCustomMode(false);
                    setCustomVolume('');
                    setItemName(eau.name);
                    setSelectedDrinkSize('');

                    {
                      const defaultSizes = {};
                      DRINK_SIZES.eau.forEach((size) => {
                        defaultSizes[size.value] = size.defaultPrice.toString();
                      });
                      setDrinkSizes(defaultSizes);
                    }
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
                    if (biere.custom) {
                      setCustomMode(true);
                      setCustomVolume('');
                      setItemName('');

                      const defaultSize = DRINK_SIZES.biere?.[0]?.value || '';
                      setSelectedDrinkSize(defaultSize);
                      setDrinkSizes(defaultSize ? { [defaultSize]: '' } : {});
                      return;
                    }

                    setCustomMode(false);
                    setCustomVolume('');
                    setItemName(biere.name);
                    setSelectedDrinkSize('');

                    {
                      const defaultSizes = {};
                      DRINK_SIZES.biere.forEach((size) => {
                        defaultSizes[size.value] = size.defaultPrice.toString();
                      });
                      setDrinkSizes(defaultSizes);
                    }
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
                    if (vin.custom) {
                      setCustomMode(true);
                      setCustomVolume('');
                      setItemName('');
                      setPriceS('');
                    } else {
                      setCustomMode(false);
                      setCustomVolume('');
                      setItemName(vin.name);
                      setPriceS(vin.defaultPrice.toString());
                    }
                  }}
                  className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
                >
                  <div className="text-3xl mb-2">{vin.emoji}</div>
                  <div className="font-semibold text-xs">{vin.name}</div>
                  {vin.defaultPrice && <div className="text-xs text-emerald-600 mt-1">{vin.defaultPrice.toFixed(2)}€</div>}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Mode "Autre" : afficher tout d'un coup */}
      {customModeActive && isSizedDrink && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Nouvelle boisson</h3>
              <p className="text-xs text-gray-600">Nom + litrage + prix, puis validez.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                // Sortie propre du mode Autre: revenir au choix boisson.
                setCustomMode(false);
                setCustomVolume('');
                setItemName('');
                setSelectedDrinkSize('');
                setDrinkSizes({});
              }}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              title="Revenir à la liste des boissons"
            >
              ← Retour à la liste
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nom</label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={itemType === 'eau' ? 'Ex: Perrier' : 'Nom de la boisson'}
              className="mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Litrage</label>
            <div className="grid grid-cols-2 gap-3">
              {sizeOptions.map((size) => {
                const active = size.value === selectedDrinkSize;
                return (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => {
                      setSelectedDrinkSize(size.value);
                      setDrinkSizes({ [size.value]: '' });
                    }}
                    className={`p-4 rounded-xl border-2 transition-all text-center ${
                      active
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-emerald-500 hover:bg-emerald-50'
                    }`}
                  >
                    <div className="text-xl font-black text-gray-900">{size.label}</div>
                  </button>
                );
              })}

              <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">Autre litrage</div>
                <p className="mt-1 text-xs text-gray-600">Ex: 33cL, 50cL, 75cL, 1L, 1,5L…</p>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={customVolume}
                    onChange={(e) => setCustomVolume(e.target.value)}
                    placeholder="Ex: 75cl"
                    className="h-10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const raw = String(customVolume || '').trim();
                      if (!raw) return;
                      const normalized = raw.replace(/\s+/g, '').toLowerCase();
                      setSelectedDrinkSize(normalized);
                      setDrinkSizes({ [normalized]: '' });
                    }}
                    className="h-10 px-4 rounded-lg border border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors text-sm font-semibold"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Prix ({selectedSizeLabel})</label>
            <Input
              value={selectedDrinkSize ? (drinkSizes[selectedDrinkSize] || '') : ''}
              onChange={(e) => {
                if (!selectedDrinkSize) return;
                setDrinkSizes({ [selectedDrinkSize]: e.target.value });
              }}
              placeholder="Ex: 2.50"
              type="number"
              step="0.01"
              min="0"
              className="mt-1"
            />
          </div>
        </div>
      )}

      {customModeActive && itemType === 'vin' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Nouveau vin</h3>
              <p className="text-xs text-gray-600">Bouteille (75cL) • Nom + prix, puis validez.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomMode(false);
                setCustomVolume('');
                setItemName('');
                setSelectedDrinkSize('');
                setDrinkSizes({});
                setPriceS('');
              }}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              title="Revenir à la liste des vins"
            >
              ← Retour à la liste
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nom</label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Ex: Côtes du Rhône"
              className="mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Prix (75cL)</label>
            <Input
              value={priceS}
              onChange={(e) => setPriceS(e.target.value)}
              placeholder="Ex: 11.50"
              type="number"
              step="0.01"
              min="0"
              className="mt-1"
            />
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
