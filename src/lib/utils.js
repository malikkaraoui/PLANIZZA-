import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Génère un slug URL-friendly à partir d'un nom de camion
 * Ex: "Pizza Napoli" -> "PIZZA_NAPOLI"
 */
export function generateSlug(name, existingSlugs = []) {
  if (!name || typeof name !== 'string') return 'TRUCK';
  
  // Normaliser: enlever accents, mettre en majuscules, remplacer espaces/chars spéciaux par _
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_') // Remplacer tout sauf lettres/chiffres par _
    .replace(/^_+|_+$/g, ''); // Enlever _ au début/fin
  
  const baseSlug = normalized || 'TRUCK';
  
  // Vérifier les doublons
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }
  
  // Si doublon, ajouter un suffixe aléatoire de 4 caractères
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${baseSlug}_${suffix}`;
}
