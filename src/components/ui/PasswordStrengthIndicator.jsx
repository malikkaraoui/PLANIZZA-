import { Check, X } from 'lucide-react';
import { validatePassword } from '../../lib/passwordValidation';

const RULES = [
  { key: 'minLength', label: '8 caractères minimum' },
  { key: 'hasUppercase', label: 'Une majuscule' },
  { key: 'hasLowercase', label: 'Une minuscule' },
  { key: 'hasNumber', label: 'Un chiffre' },
  { key: 'hasSpecial', label: 'Un caractère spécial (!@#$...)' },
];

export default function PasswordStrengthIndicator({ password = '' }) {
  const result = validatePassword(password);

  if (!password) return null;

  return (
    <ul className="mt-2 space-y-1">
      {RULES.map(({ key, label }) => {
        const ok = result[key];
        return (
          <li
            key={key}
            className={`flex items-center gap-2 text-xs font-medium transition-colors ${
              ok ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            {ok ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0" />
            )}
            {label}
          </li>
        );
      })}
    </ul>
  );
}
