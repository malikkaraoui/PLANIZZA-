/**
 * Formate le nom d'un item du panier pour corriger les volumes de boissons
 * Ex: "Cristaline 1l" -> "Cristaline 1L"
 */
export function formatCartItemName(name) {
  if (!name) return name;
  
  return String(name)
    .replace(/\b1l\b/g, '1L')
    .replace(/\b1\.5l\b/g, '1,5L')
    .replace(/\b25cl\b/gi, '25cL')
    .replace(/\b33cl\b/gi, '33cL')
    .replace(/\b50cl\b/gi, '50cL')
    .replace(/\b75cl\b/gi, '75cL');
}
