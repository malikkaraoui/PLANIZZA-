import { Input } from '../../../../components/ui/Input';
import { DRINK_SIZES, VINS } from '../../constants';

export function PizzaioloMenuCommonFields({
  selectedCategory,
  itemType,
  itemName,
  setItemName,
  itemDesc,
  setItemDesc,
  isCustomMode,

  priceS,
  setPriceS,
  priceM,
  setPriceM,
  priceL,
  setPriceL,

  diameterS,
  setDiameterS,
  diameterM,
  setDiameterM,
  diameterL,
  setDiameterL,

  drinkSizes,
  setDrinkSizes,
  selectedDrinkSize,
}) {
  // Pour les boissons avec tailles, attendre la sélection de taille
  if (['soda', 'eau', 'biere'].includes(itemType) && !selectedDrinkSize) return null;
  
  // Pour pizza/calzone : toujours afficher les champs (même si itemName vide pour "La Perso")
  // Pour autres catégories : afficher seulement si un item a été sélectionné
  const shouldShow = (selectedCategory === 'pizza' || selectedCategory === 'calzone') || itemName;
  if (!shouldShow) return null;

  const nameReadOnly =
    itemName !== 'Autre' &&
    selectedCategory !== 'calzone' &&
    selectedCategory !== 'pizza' &&
    itemType !== 'soda' &&
    itemType !== 'eau' &&
    itemType !== 'biere' &&
    itemType !== 'vin';

  // Masquer le champ nom en mode custom (il est déjà dans le customizer)
  const showNameField = !isCustomMode;

  return (
    <>
      {showNameField && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Nom</label>
          <Input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="mt-1"
            readOnly={nameReadOnly}
            placeholder={selectedCategory === 'pizza' ? 'Ex: Ma Pizza spéciale...' : 'Nom du produit'}
          />
        </div>
      )}

      {(selectedCategory === 'pizza' || selectedCategory === 'calzone') && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Ingrédients</label>
          <textarea
            value={itemDesc}
            onChange={(e) => setItemDesc(e.target.value)}
            placeholder="Ex: Tomate, mozzarella, basilic frais..."
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={3}
          />
        </div>
      )}

      {(selectedCategory === 'pizza' || selectedCategory === 'calzone') && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">Tailles et prix * (minimum 1, maximum 3)</p>
          <p className="text-xs text-gray-500">Prix : S {'<'} M {'<'} L • Diamètres : S {'<'} M {'<'} L</p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">S (Petite)</label>
              <div className="space-y-2">
                <Input
                  value={priceS}
                  onChange={(e) => setPriceS(e.target.value)}
                  placeholder="Prix €"
                  type="number"
                  step="0.01"
                  min="0"
                />
                <Input
                  value={diameterS}
                  onChange={(e) => setDiameterS(e.target.value)}
                  placeholder="Ø cm"
                  type="number"
                  min="15"
                  max="50"
                  disabled={!priceS}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">M (Moyenne)</label>
              <div className="space-y-2">
                <Input
                  value={priceM}
                  onChange={(e) => setPriceM(e.target.value)}
                  placeholder="Prix €"
                  type="number"
                  step="0.01"
                  min="0"
                />
                <Input
                  value={diameterM}
                  onChange={(e) => setDiameterM(e.target.value)}
                  placeholder="Ø cm"
                  type="number"
                  min="15"
                  max="50"
                  disabled={!priceM}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">L (Grande)</label>
              <div className="space-y-2">
                <Input
                  value={priceL}
                  onChange={(e) => setPriceL(e.target.value)}
                  placeholder="Prix €"
                  type="number"
                  step="0.01"
                  min="0"
                />
                <Input
                  value={diameterL}
                  onChange={(e) => setDiameterL(e.target.value)}
                  placeholder="Ø cm"
                  type="number"
                  min="15"
                  max="50"
                  disabled={!priceL}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {['soda', 'eau', 'biere'].includes(itemType) && selectedDrinkSize && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prix {DRINK_SIZES[itemType]?.find((s) => s.value === selectedDrinkSize)?.label} (€) *
          </label>
          <Input
            value={drinkSizes[selectedDrinkSize] || ''}
            onChange={(e) => setDrinkSizes({ [selectedDrinkSize]: e.target.value })}
            placeholder={`${DRINK_SIZES[itemType]?.find((s) => s.value === selectedDrinkSize)?.defaultPrice.toFixed(2)}`}
            type="number"
            step="0.01"
            min="0"
          />
        </div>
      )}

      {(itemType === 'vin' || itemType === 'dessert') && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Prix (€) *</label>
          <Input
            value={priceS}
            onChange={(e) => setPriceS(e.target.value)}
            placeholder={
              itemType === 'vin' && itemName ? (VINS.find((v) => v.name === itemName)?.defaultPrice?.toFixed(2) || '5.00') : '5.00'
            }
            type="number"
            step="0.01"
            min="0"
            required
            className="mt-1"
          />
        </div>
      )}
    </>
  );
}
