import { useState, useCallback } from 'react';

/**
 * Hook pour gérer la saisie d'un numéro de téléphone français
 * - Formate automatiquement avec des espaces (06 12 34 56 78)
 * - Limite à 10 chiffres
 * - Gère l'indicatif +33 (fixe pour la France)
 */
export function usePhoneInput(initialValue = '') {
  // Formater la valeur initiale
  const formatPhoneNumber = useCallback((value) => {
    // Supprimer tout sauf les chiffres
    const digits = value.replace(/\D/g, '');
    // Limiter à 10 chiffres
    const limited = digits.slice(0, 10);
    // Ajouter un espace tous les 2 chiffres
    const formatted = limited.replace(/(\d{2})(?=\d)/g, '$1 ');
    return formatted;
  }, []);

  const [phoneNumber, setPhoneNumber] = useState(() => formatPhoneNumber(initialValue));
  const phonePrefix = '+33'; // Fixe pour la France

  const handlePhoneChange = useCallback((e) => {
    const value = typeof e === 'string' ? e : e.target.value;
    const formatted = formatPhoneNumber(value);
    setPhoneNumber(formatted);
  }, [formatPhoneNumber]);

  // Retourne le numéro complet avec indicatif (pour sauvegarde)
  const getFullPhoneNumber = useCallback(() => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (!digits) return '';
    return `${phonePrefix} ${phoneNumber}`;
  }, [phoneNumber, phonePrefix]);

  // Retourne uniquement les chiffres (pour validation)
  const getDigitsOnly = useCallback(() => {
    return phoneNumber.replace(/\D/g, '');
  }, [phoneNumber]);

  // Validation : 10 chiffres requis
  const isValid = useCallback(() => {
    return getDigitsOnly().length === 10;
  }, [getDigitsOnly]);

  // Parser un numéro complet (avec ou sans indicatif)
  const parseFullNumber = useCallback((fullNumber) => {
    if (!fullNumber) return;

    let numWithoutPrefix = fullNumber;

    // Supprimer l'indicatif +33 s'il existe
    if (fullNumber.startsWith('+33')) {
      numWithoutPrefix = fullNumber.replace(/^\+33\s*/, '');
    } else if (fullNumber.startsWith('+')) {
      // Autre indicatif (legacy) : on prend juste le numéro
      const match = fullNumber.match(/^\+\d{1,3}\s*(.*)$/);
      if (match) {
        numWithoutPrefix = match[1];
      }
    }

    setPhoneNumber(formatPhoneNumber(numWithoutPrefix));
  }, [formatPhoneNumber]);

  return {
    phoneNumber,
    phonePrefix,
    setPhoneNumber: handlePhoneChange,
    getFullPhoneNumber,
    getDigitsOnly,
    isValid,
    parseFullNumber,
    formatPhoneNumber,
  };
}

export default usePhoneInput;
