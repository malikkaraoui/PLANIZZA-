/**
 * Input téléphone avec préfixe +33 fixe
 * Formate automatiquement le numéro : 6 XX XX XX XX ou 7 XX XX XX XX
 */
export default function PhoneInputWithPrefix({ value, onChange, placeholder = "6 12 34 56 78", className = "" }) {
  // Formater le numéro de téléphone français (partie après +33)
  const formatPhoneNumber = (inputValue) => {
    // Supprimer tout sauf les chiffres
    let digits = inputValue.replace(/\D/g, '');
    
    // Si commence par 33 (cas où l'utilisateur colle +33...), on le retire
    if (digits.startsWith('33')) {
      digits = digits.slice(2);
    }
    
    // Si commence par 0, on le retire (06... → 6...)
    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    
    // Si vide après nettoyage, retourner vide
    if (digits.length === 0) return '';
    
    // Vérifier que ça commence par 6 ou 7
    if (!digits.startsWith('6') && !digits.startsWith('7')) {
      return ''; // Refuser les autres formats
    }
    
    // Limiter à 9 chiffres (6 ou 7 + 8 chiffres)
    digits = digits.slice(0, 9);
    
    // Formater : 6 XX XX XX XX ou 7 XX XX XX XX
    if (digits.length > 0) {
      let formatted = digits.charAt(0); // Le 6 ou 7
      
      const rest = digits.slice(1);
      for (let i = 0; i < rest.length; i += 2) {
        formatted += ' ' + rest.slice(i, i + 2);
      }
      
      return formatted.trim();
    }
    
    return '';
  };

  const handleChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
  };

  return (
    <div className={`relative flex items-center rounded-xl border border-gray-300 bg-white h-12 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all ${className}`}>
      <span className="pl-4 pr-2 text-sm font-bold text-gray-500 select-none">
        +33
      </span>
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 h-full px-3 bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-400"
        style={{ WebkitAppearance: 'none', appearance: 'none' }}
      />
    </div>
  );
}
