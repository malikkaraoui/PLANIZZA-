/**
 * Valide un mot de passe selon les criteres de securite.
 * @param {string} password
 * @returns {{ minLength: boolean, hasUppercase: boolean, hasLowercase: boolean, hasNumber: boolean, hasSpecial: boolean }}
 */
export function validatePassword(password = '') {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

/**
 * Retourne true si le mot de passe remplit tous les criteres.
 */
export function isPasswordValid(password) {
  const result = validatePassword(password);
  return Object.values(result).every(Boolean);
}
