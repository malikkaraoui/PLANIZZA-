import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';

const EMOJI_OPTIONS = [
  '🍅', '🧅', '🫑', '🥒', '🥕', '🌽', '🍄', '🥦', '🥬', '🧄',
  '🧀', '🥓', '🍖', '🍗', '🥩', '🦐', '🐟', '🥚', '🫒', '🌶️',
  '🥜', '🌿', '🍋', '🥑', '🍯', '🫘', '🥗', '🍝', '🧈', '🥛'
];

export function CustomIngredientModal({ 
  type, // 'base' | 'garniture' | 'fromage'
  isOpen, 
  onClose, 
  onSave 
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍅');

  if (!isOpen) return null;

  const typeLabel = {
    base: 'Base',
    garniture: 'Garniture',
    fromage: 'Fromage'
  }[type] || 'Ingrédient';

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), emoji, type });
    setName('');
    setEmoji('🍅');
    onClose();
  };

  const handleCancel = () => {
    setName('');
    setEmoji('🍅');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          ➕ Nouvel ingrédient : {typeLabel}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom * (maximum 30 caractères)
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 30))}
              placeholder={`Ex: Pesto maison, Mortadelle...`}
              maxLength={30}
            />
            <p className="text-xs text-gray-500 mt-1">
              {name.length}/30 caractères
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Emoji
            </label>
            <div className="grid grid-cols-10 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {EMOJI_OPTIONS.map((emojiOption) => (
                <button
                  key={emojiOption}
                  type="button"
                  onClick={() => setEmoji(emojiOption)}
                  className={`text-2xl p-2 rounded-lg transition-all ${
                    emoji === emojiOption
                      ? 'bg-emerald-100 ring-2 ring-emerald-500'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {emojiOption}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="flex-1 rounded-2xl font-bold border-orange-500/40 text-orange-600 hover:bg-orange-500/10"
          >
            <X className="h-4 w-4" />
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 rounded-2xl font-bold bg-orange-500 hover:bg-orange-600"
          >
            Valider
          </Button>
        </div>
      </div>
    </div>
  );
}
