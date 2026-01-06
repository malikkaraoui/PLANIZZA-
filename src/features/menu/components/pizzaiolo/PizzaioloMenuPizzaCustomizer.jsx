import { useState } from 'react';
import { BASES, FROMAGES, GARNITURES } from '../../constants';
import { Input } from '../../../../components/ui/Input';
import { CustomIngredientModal } from './CustomIngredientModal';
import { Trash2 } from 'lucide-react';

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
  onRemoveCustomIngredient,
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

  const baseOptions = [
    ...BASES.map((name) => ({ key: name, name, isCustom: false })),
    ...customBases.map((b) => ({ key: b.id || b.name, id: b.id, name: b.name, isCustom: true })),
  ];

  const garnitureOptions = [
    ...GARNITURES.map((name) => ({ key: name, name, isCustom: false })),
    ...customGarnitures.map((g) => ({ key: g.id || g.name, id: g.id, name: g.name, isCustom: true })),
  ];

  const fromageOptions = [
    ...FROMAGES.map((name) => ({ key: name, name, isCustom: false })),
    ...customFromages.map((f) => ({ key: f.id || f.name, id: f.id, name: f.name, isCustom: true })),
  ];

  const handleRemove = async (type, option) => {
    if (!option?.isCustom) return;
    if (!onRemoveCustomIngredient) return;

    const confirmLabel = option?.name ? `\"${option.name}\"` : 'cet élément';
    if (!confirm(`Supprimer ${confirmLabel} ?`)) return;

    try {
      await onRemoveCustomIngredient(type, { id: option?.id, name: option?.name });
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'ingrédient:', error);
      alert(error?.message || 'Erreur lors de la suppression');
    }
  };

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
          {baseOptions.map((option) => (
            <div key={option.key} className="relative">
              <button
                type="button"
                onClick={() => setSelectedBase(option.name)}
                className={`w-full p-3 rounded-lg border-2 transition-all text-sm text-left pr-10 ${
                  selectedBase === option.name
                    ? 'border-emerald-500 bg-emerald-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                title={option.name}
              >
                {option.name}
              </button>

              {option.isCustom && (
                <button
                  type="button"
                  onClick={() => handleRemove('base', option)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Supprimer cet ingrédient personnalisé"
                  aria-label={`Supprimer ${option.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
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
          {garnitureOptions.map((option) => (
            <div key={option.key} className="relative">
              <button
                type="button"
                onClick={() => {
                  setSelectedGarnitures((prev) =>
                    prev.includes(option.name)
                      ? prev.filter((g) => g !== option.name)
                      : [...prev, option.name]
                  );
                }}
                className={`w-full p-2 rounded-lg border-2 transition-all text-xs text-left pr-9 ${
                  selectedGarnitures.includes(option.name)
                    ? 'border-emerald-500 bg-emerald-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                title={option.name}
              >
                {option.name}
              </button>

              {option.isCustom && (
                <button
                  type="button"
                  onClick={() => handleRemove('garniture', option)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Supprimer cet ingrédient personnalisé"
                  aria-label={`Supprimer ${option.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
          {fromageOptions.map((option) => (
            <div key={option.key} className="relative">
              <button
                type="button"
                onClick={() => {
                  setSelectedFromages((prev) =>
                    prev.includes(option.name)
                      ? prev.filter((f) => f !== option.name)
                      : [...prev, option.name]
                  );
                }}
                className={`w-full p-2 rounded-lg border-2 transition-all text-xs text-left pr-9 ${
                  selectedFromages.includes(option.name)
                    ? 'border-emerald-500 bg-emerald-50 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                title={option.name}
              >
                {option.name}
              </button>

              {option.isCustom && (
                <button
                  type="button"
                  onClick={() => handleRemove('fromage', option)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Supprimer cet ingrédient personnalisé"
                  aria-label={`Supprimer ${option.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
