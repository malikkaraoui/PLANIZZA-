import { useState } from 'react';
import { BASES, FROMAGES, GARNITURES_BY_CATEGORY } from '../../constants';
import { Input } from '../../../../components/ui/Input';
import { CustomIngredientModal } from './CustomIngredientModal';
import { Trash2 } from 'lucide-react';

export function PizzaioloMenuPizzaCustomizer({
  selectedCategory,
  isCustomMode,
  onExitCustom,
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

    const confirmLabel = option?.name ? `"${option.name}"` : 'cet élément';
    if (!confirm(`Supprimer ${confirmLabel} ?`)) return;

    try {
      await onRemoveCustomIngredient(type, { id: option?.id, name: option?.name });
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'ingrédient:', error);
      alert(error?.message || 'Erreur lors de la suppression');
    }
  };

  const getTone = (groupLabel) => {
    // IMPORTANT: pas de classes Tailwind dynamiques (sinon purge/JIT). On retourne des strings complètes.
    switch (groupLabel) {
      case '🥩 Viandes':
        return {
          groupWrap: 'border-rose-200 bg-rose-50/60',
          groupBar: 'bg-rose-50 border-rose-200 text-rose-800',
          chipIdle: 'border-rose-200 hover:border-rose-300 bg-white/70 text-gray-800',
          chipActive: 'border-rose-500 bg-rose-50 text-rose-900',
        };
      case '🐟 Poissons':
        return {
          groupWrap: 'border-sky-200 bg-sky-50/60',
          groupBar: 'bg-sky-50 border-sky-200 text-sky-800',
          chipIdle: 'border-sky-200 hover:border-sky-300 bg-white/70 text-gray-800',
          chipActive: 'border-sky-500 bg-sky-50 text-sky-900',
        };
      case '🥬 Légumes & végétal':
        return {
          groupWrap: 'border-emerald-200 bg-emerald-50/60',
          groupBar: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          chipIdle: 'border-emerald-200 hover:border-emerald-300 bg-white/70 text-gray-800',
          chipActive: 'border-emerald-500 bg-emerald-50 text-emerald-900',
        };
      case '🧄 Sauces & condiments':
        return {
          groupWrap: 'border-amber-200 bg-amber-50/60',
          groupBar: 'bg-amber-50 border-amber-200 text-amber-900',
          chipIdle: 'border-amber-200 hover:border-amber-300 bg-white/70 text-gray-800',
          chipActive: 'border-amber-500 bg-amber-50 text-amber-950',
        };
      case '🥚 Extras':
        return {
          groupWrap: 'border-violet-200 bg-violet-50/60',
          groupBar: 'bg-violet-50 border-violet-200 text-violet-800',
          chipIdle: 'border-violet-200 hover:border-violet-300 bg-white/70 text-gray-800',
          chipActive: 'border-violet-500 bg-violet-50 text-violet-900',
        };
      default:
        return {
          groupWrap: 'border-gray-200 bg-white/50',
          groupBar: 'bg-white border-gray-200 text-gray-700',
          chipIdle: 'border-gray-200 hover:border-gray-300 bg-white/70 text-gray-800',
          chipActive: 'border-gray-500 bg-gray-50 text-gray-900',
        };
    }
  };

  const fromagesTone = {
    groupWrap: 'border-amber-200 bg-amber-50/50',
    groupBar: 'bg-amber-50 border-amber-200 text-amber-900',
    chipIdle: 'border-amber-200 hover:border-amber-300 bg-white/70 text-gray-800',
    chipActive: 'border-amber-500 bg-amber-50 text-amber-950',
  };

  const customTone = {
    groupWrap: 'border-fuchsia-200 bg-fuchsia-50/50',
    groupBar: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800',
    chipIdle: 'border-fuchsia-200 hover:border-fuchsia-300 bg-white/70 text-gray-800',
    chipActive: 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-900',
  };

  return (
    <div className="space-y-6">
      <div className="glass-premium glass-glossy border-white/20 p-5 rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-900">🍕 {title}</h3>
            <p className="text-xs text-gray-600 mt-1">
              Base + Fromages requis. Les garnitures sont optionnelles.
            </p>
          </div>
          <div className="text-right">
            {typeof onExitCustom === 'function' && (
              <button
                type="button"
                onClick={() => onExitCustom()}
                className="mb-2 inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                title={selectedCategory === 'calzone' ? 'Revenir à la liste des calzones' : 'Revenir à la liste des pizzas'}
              >
                ← Retour à la liste
              </button>
            )}

            <div className="text-[11px] text-gray-600 leading-5">
              <div>
                <span className="font-semibold">Base :</span> {selectedBase || '—'}
              </div>
              <div>
                <span className="font-semibold">Fromages :</span> {selectedFromages.length}
              </div>
              <div>
                <span className="font-semibold">Garnitures :</span> {selectedGarnitures.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Colonne 1 : identité + base + fromages (AVANT garnitures) */}
        <div className="glass-premium glass-glossy border-white/20 p-5 rounded-3xl space-y-5">
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
            <div className={`rounded-2xl border p-3 ${fromagesTone.groupWrap}`}>
              <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${fromagesTone.groupBar}`}>
                <label className="block text-sm font-black">🧀 Fromages *</label>
                <span className="text-xs">(multi)</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
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
                      selectedFromages.includes(option.name) ? fromagesTone.chipActive : fromagesTone.chipIdle
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
                className="px-3 py-2 rounded-full border-2 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50 transition-all text-xs font-semibold text-amber-900"
              >
                ➕ Autre
              </button>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne 2 : garnitures */}
        <div className="glass-premium glass-glossy border-white/20 p-5 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-gray-800">🥗 Garnitures</label>
            <span className="text-xs text-gray-600">(multi)</span>
          </div>

          <div className="space-y-4">
            {garniturePresetGroups.map((group) => (
              <div key={group.groupLabel} className={`rounded-2xl border p-3 ${getTone(group.groupLabel).groupWrap}`}>
                <div className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-black ${getTone(group.groupLabel).groupBar}`}>
                  {group.groupLabel}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
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
                          ? getTone(group.groupLabel).chipActive
                          : getTone(group.groupLabel).chipIdle
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
              <div className={`rounded-2xl border p-3 ${customTone.groupWrap}`}>
                <div className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-black ${customTone.groupBar}`}>
                  ✨ Personnalisées
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
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
                          selectedGarnitures.includes(option.name) ? customTone.chipActive : customTone.chipIdle
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
              className="w-full p-2.5 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-xs font-semibold text-emerald-900"
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
