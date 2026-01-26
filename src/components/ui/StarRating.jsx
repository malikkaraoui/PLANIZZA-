import { useState } from 'react';
import { Star } from 'lucide-react';

/**
 * Composant de notation par étoiles (1-5)
 * @param {number} value - Note actuelle (0-5)
 * @param {function} onChange - Callback appelé quand la note change
 * @param {boolean} readonly - Si true, désactive l'interaction
 * @param {string} size - Taille des étoiles ('sm', 'md', 'lg')
 */
export default function StarRating({ value = 0, onChange, readonly = false, size = 'md' }) {
  const [hovered, setHovered] = useState(0);

  const sizes = {
    sm: 'h-5 w-5',
    md: 'h-7 w-7',
    lg: 'h-9 w-9',
  };

  const sizeClass = sizes[size] || sizes.md;

  const handleClick = (rating) => {
    if (!readonly && onChange) {
      onChange(rating);
    }
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= (hovered || value);

        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => handleClick(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={`
              transition-all duration-150
              ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'}
              focus:outline-none
            `}
          >
            <Star
              className={`
                ${sizeClass}
                transition-colors duration-150
                ${isFilled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-transparent text-gray-300'
                }
              `}
            />
          </button>
        );
      })}
    </div>
  );
}
