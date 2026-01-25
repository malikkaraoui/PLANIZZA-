import { Input } from './Input';

/**
 * Composant d'input téléphone avec indicatif +33 fixe (France)
 * et formatage automatique avec espaces (06 12 34 56 78)
 */
export default function PhoneInput({
  value,
  onChange,
  placeholder = '06 12 34 56 78',
  className = '',
  disabled = false,
  required = false,
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="w-24 rounded-md border border-gray-200 px-3 py-2 text-sm bg-gray-100 text-gray-500 flex items-center shrink-0">
        🇫🇷 +33
      </div>
      <Input
        type="tel"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="flex-1"
        disabled={disabled}
        required={required}
        autoComplete="tel-national"
      />
    </div>
  );
}
