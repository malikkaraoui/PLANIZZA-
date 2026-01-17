import { DRINK_SIZES, VINS } from '../constants';

function parsePositiveFloat(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;
  const n = Number.parseFloat(str);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parsePositiveInt(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;
  const n = Number.parseInt(str, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Construit un payload RTDB d'item de menu à partir d'un draft UI.
 * Objectif: 1 seule source de vérité pour la structure stockée en DB.
 *
 * @param {object} draft
 * @returns {{ ok: true, itemData: object } | { ok: false, error: string }}
 */
export function buildMenuItemData(draft) {
  const type = draft?.type;
  const name = (draft?.name || '').trim();
  const description = (draft?.description || '').trim();
  const photo = draft?.photo || null;

  if (!name) return { ok: false, error: 'Nom manquant' };

  const itemData = {
    name,
    description,
    type,
    createdAt: Date.now(),
  };

  // Ajouter la photo si présente
  if (photo) {
    itemData.photo = photo;
  }

  // Pizza: sizes S/M/L
  if (type === 'pizza') {
    const sPrice = parsePositiveFloat(draft?.priceS);
    const mPrice = parsePositiveFloat(draft?.priceM);
    const lPrice = parsePositiveFloat(draft?.priceL);

    const sDiameter = parsePositiveInt(draft?.diameterS);
    const mDiameter = parsePositiveInt(draft?.diameterM);
    const lDiameter = parsePositiveInt(draft?.diameterL);

    const sizes = {};
    if (sPrice && sDiameter) sizes.s = { priceCents: Math.round(sPrice * 100), diameter: sDiameter };
    if (mPrice && mDiameter) sizes.m = { priceCents: Math.round(mPrice * 100), diameter: mDiameter };
    if (lPrice && lDiameter) sizes.l = { priceCents: Math.round(lPrice * 100), diameter: lDiameter };

    if (Object.keys(sizes).length === 0) {
      return { ok: false, error: 'Aucune taille valide pour la pizza' };
    }

    itemData.sizes = sizes;
    return { ok: true, itemData };
  }

  // Boissons avec tailles: une taille sélectionnée + prix
  if (type === 'soda' || type === 'eau' || type === 'biere') {
    const selectedSize = String(draft?.selectedDrinkSize || '').trim();
    if (!selectedSize) return { ok: false, error: 'Taille boisson manquante' };

    const priceRaw = draft?.drinkSizes?.[selectedSize];
    const priceParsed = parsePositiveFloat(priceRaw);

    const defaultPrice = DRINK_SIZES?.[type]?.find((s) => s.value === selectedSize)?.defaultPrice;
    const finalPrice = priceParsed ?? (typeof defaultPrice === 'number' && defaultPrice > 0 ? defaultPrice : null);

    if (!finalPrice) return { ok: false, error: 'Prix boisson invalide' };

    itemData.sizes = {
      [selectedSize]: { priceCents: Math.round(finalPrice * 100) },
    };

    return { ok: true, itemData };
  }

  // Vin: prix unique (bouteille)
  if (type === 'vin') {
    const priceParsed = parsePositiveFloat(draft?.priceS);
    const defaultPrice = VINS?.find((v) => v.name === name)?.defaultPrice;
    const finalPrice = priceParsed ?? (typeof defaultPrice === 'number' && defaultPrice > 0 ? defaultPrice : null);
    if (!finalPrice) return { ok: false, error: 'Prix vin invalide' };

    const cents = Math.round(finalPrice * 100);

    // Par défaut: bouteille 75cL.
    // - On stocke aussi `priceCents` pour compatibilité avec l'existant.
    itemData.sizes = {
      '75cl': { priceCents: cents },
    };
    itemData.priceCents = cents;
    return { ok: true, itemData };
  }

  // Calzone / dessert: prix unique
  if (type === 'calzone' || type === 'dessert') {
    const priceParsed = parsePositiveFloat(draft?.priceS);
    if (!priceParsed) return { ok: false, error: 'Prix invalide' };

    itemData.priceCents = Math.round(priceParsed * 100);
    return { ok: true, itemData };
  }

  // Fallback: prix unique optionnel
  const priceParsed = parsePositiveFloat(draft?.priceS);
  if (priceParsed) itemData.priceCents = Math.round(priceParsed * 100);

  return { ok: true, itemData };
}
