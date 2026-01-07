import { useState } from 'react';
import { BASES, FROMAGES, GARNITURES_BY_CATEGORY } from '../../constants';
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

  const garniturePresetGroups = Object.entries(GARNITURES_BY_CATEGORY || {}).map(([groupLabel, names]) => ({
    groupLabel,
    options: (names || []).map((name) => ({ key: `preset:${groupLabel}:${name}`, name, isCustom: false })),
  }));

  const garnitureCustomOptions = customGarnitures.map((g) => ({
    key: `custom:${g.id || g.name}`,
    id: g.id,
    name: g.name,
    isCustom: true,
  }));

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
    <div className="space-y-6">
      <div className="glass-premium glass-glossy border-white/20 p-5 rounded-[24px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-900">🍕 {title}</h3>
            <p className="text-xs text-gray-600 mt-1">
              Base + Fromages requis. Les garnitures sont optionnelles.
            </p>
          </div>
          <div className="text-right text-[11px] text-gray-600 leading-5">
            <div><span className="font-semibold">Base :</span> {selectedBase || '—'}</div>
            <div><span className="font-semibold">Fromages :</span> {selectedFromages.length}</div>
            <div><span className="font-semibold">Garnitures :</span> {selectedGarnitures.length}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Colonne 1 : identité + base + fromages (AVANT garnitures) */}
        <div className="glass-premium glass-glossy border-white/20 p-5 rounded-[24px] space-y-5">
          {/* Nom de la pizza/calzone */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Nom de {selectedCategory === 'calzone' ? 'la calzone' : 'la pizza'}
            </label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={selectedCategory === 'calzone' ? 'Ex: Ma Calzone spéciale...' : 'Ex: Ma Pizza spéciale...'}
            />
            <p className="text-xs text-gray-600 mt-1">
              Vous pouvez garder "Autre" ou personnaliser le nom
            </p>
          </div>

          {/* Base */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-800">Base *</label>
              <span className="text-xs text-gray-600">(1 choix)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {baseOptions.map((option) => (
                <div key={option.key} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedBase(option.name)}
                    className={`w-full p-3 rounded-xl border-2 transition-all text-sm text-left pr-10 ${
                      selectedBase === option.name
                        ? 'border-emerald-500 bg-emerald-50 font-semibold'
                        : 'border-gray-200 hover:border-gray-300 bg-white/60'
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
                className="p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-sm font-medium text-gray-700"
              >
                ➕ Autre
              </button>
            </div>
          </div>

          {/* Fromages (avant garnitures) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-800">🧀 Fromages *</label>
              <span className="text-xs text-gray-600">(multi)</span>
            </div>

            <div className="flex flex-wrap gap-2">
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
                    className={`px-3 py-2 rounded-full border-2 transition-all text-xs font-medium ${
                      selectedFromages.includes(option.name)
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-gray-200 hover:border-gray-300 bg-white/60 text-gray-800'
                    }`}
                    title={option.name}
                  >
                    {option.name}
                  </button>

                  {option.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleRemove('fromage', option)}
                      className="absolute -right-1 -top-1 p-1 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Supprimer cet ingrédient personnalisé"
                      aria-label={`Supprimer ${option.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleOpenModal('fromage')}
                className="px-3 py-2 rounded-full border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-xs font-semibold text-gray-700"
              >
                ➕ Autre
              </button>
            </div>
          </div>
        </div>

        {/* Colonne 2 : garnitures */}
        <div className="glass-premium glass-glossy border-white/20 p-5 rounded-[24px] space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-gray-800">🥗 Garnitures</label>
            <span className="text-xs text-gray-600">(multi)</span>
          </div>

          <div className="space-y-4">
            {garniturePresetGroups.map((group) => (
              <div key={group.groupLabel} className="space-y-2">
                <div className="text-xs font-semibold text-gray-600">{group.groupLabel}</div>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setSelectedGarnitures((prev) =>
                          prev.includes(option.name)
                            ? prev.filter((g) => g !== option.name)
                            : [...prev, option.name]
                        );
                      }}
                      className={`px-3 py-2 rounded-full border-2 transition-all text-xs font-medium ${
                        selectedGarnitures.includes(option.name)
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : 'border-gray-200 hover:border-gray-300 bg-white/60 text-gray-800'
                      }`}
                      title={option.name}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {garnitureCustomOptions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-600">✨ Personnalisées</div>
                <div className="flex flex-wrap gap-2">
                  {garnitureCustomOptions.map((option) => (
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
                        className={`px-3 py-2 rounded-full border-2 transition-all text-xs font-medium pr-8 ${
                          selectedGarnitures.includes(option.name)
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-gray-200 hover:border-gray-300 bg-white/60 text-gray-800'
                        }`}
                        title={option.name}
                      >
                        {option.name}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemove('garniture', option)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Supprimer cet ingrédient personnalisé"
                        aria-label={`Supprimer ${option.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleOpenModal('garniture')}
              className="w-full p-2.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-xs font-semibold text-gray-700"
            >
              ➕ Ajouter une garniture personnalisée
            </button>
          </div>
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
