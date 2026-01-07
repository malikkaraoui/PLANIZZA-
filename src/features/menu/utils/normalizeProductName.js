/**
 * Normalise les libellés produits provenant du menu/RTDB.
 *
 * Objectif: corriger des fautes fréquentes dans les données sans casser l'historique.
 * Exemple: "Cristalline" -> "Cristaline".
 */
export const normalizeProductName = (name) => {
  if (typeof name !== 'string') return '';

  return name
    .trim()
    .replace(/\bCristalline\b/gi, 'Cristaline');
};
