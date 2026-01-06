import { useState } from 'react';
import { BASES, FROMAGES, GARNITURES } from '../../constants';
import { Input } from '../../../../components/ui/Input';
import { CustomIngredientModal } from './CustomIngredientModal';

export function PizzaioloMenuPizzaCustomizer({
  selectedCategory,
  isCustomMode,
  itemName,
  setItemName,
  selectedBase,
  setSelectedBase,
  selectedGarnitures,
  setSelectedGarnitures,
  selectedFromages,
  setSelectedFromages,
  customBases = [],
  customGarnitures = [],
  customFromages = [],
  onAddCustomIngredient,
  canAddMore = true,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);

  if (!['pizza', 'calzone'].includes(selectedCategory)) return null;
  if (!isCustomMode) return null;

  const title = selectedCategory === 'calzone' ? 'Composez votre calzone' : 'Composez votre pizza';

  const handleOpenModal = (type) => {
    if (!canAddMore) {
      alert('Maximum 50 ingrédients personnalisés atteint');
      return;
    }
    setModalType(type);
    setModalOpen(true);
  };

  const handleSaveCustomIngredient = async (ingredient) => {
    try {
      if (!onAddCustomIngredient) {
        console.error('onAddCustomIngredient n\'est pas défini');
        alert('Erreur : impossible d\'ajouter l\'ingrédient');
        return;
      }
      await onAddCustomIngredient(ingredient);
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'ingrédient:', error);
      alert(error.message);
    }
  };

  const allBases = [...BASES, ...customBases.map(b => b.name)];
  const allGarnitures = [...GARNITURES, ...customGarnitures.map(g => g.name)];
  const allFromages = [...FROMAGES, ...customFromages.map(f => f.name)];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">🍕 {title}</h3>

      {/* Nom de la pizza/calzone EN PREMIER */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nom de {selectedCategory === 'calzone' ? 'la calzone' : 'la pizza'}
        </label>
        <Input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder={selectedCategory === 'calzone' ? 'Ex: Ma Calzone spéciale...' : 'Ex: Ma Pizza spéciale...'}
        />
        <p className="text-xs text-gray-500 mt-1">
          Vous pouvez garder "Autre" ou personnaliser le nom
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Base *</label>
        <div className="grid grid-cols-2 gap-3">
          {allBases.map((base) => (
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
          <button
            type="button"
            onClick={() => handleOpenModal('base')}
            className="p-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-sm font-medium text-gray-600"
          >
            ➕ Autre
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Garnitures</label>
        <div className="grid grid-cols-2 gap-2">
          {allGarnitures.map((garniture) => (
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
          <button
            type="button"
            onClick={() => handleOpenModal('garniture')}
            className="p-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-xs font-medium text-gray-600"
          >
            ➕ Autre
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Fromages *</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {allFromages.map((fromage) => (
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
          <button
            type="button"
            onClick={() => handleOpenModal('fromage')}
            className="p-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-xs font-medium text-gray-600"
          >
            ➕ Autre
          </button>
        </div>
      </div>

      <CustomIngredientModal
        type={modalType}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCustomIngredient}
      />
    </div>
  );
}
