/**
 * ⚠️ Déprécié.
 *
 * Le projet ne doit pas "corriger" les libellés au moment de l'affichage.
 * Les corrections doivent se faire à la source (données Firebase / back-office).
 */
export const normalizeProductName = (name) => (typeof name === 'string' ? name : '');
