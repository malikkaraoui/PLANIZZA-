/**
 * Validation centralisée d'un draft d'item menu (UI pizzaiolo).
 *
 * Le but est d'avoir 1 seule source de vérité pour les règles de base
 * (prix > 0, tailles cohérentes, diamètres croissants, etc.).
 *
 * Cette fonction ne touche pas Firebase et ne fait pas de side-effects.
 */

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

export function validateMenuItemDraft(draft) {
  const errors = [];

  const type = draft?.type;
  const name = (draft?.name || '').trim();

  if (!name) {
    errors.push('❌ Le nom est obligatoire');
    return { ok: false, errors };
  }

  // Pizza: tailles multiples optionnelles (S/M/L) mais au moins une.
  if (type === 'pizza') {
    const sPrice = parsePositiveFloat(draft?.priceS);
    const mPrice = parsePositiveFloat(draft?.priceM);
    const lPrice = parsePositiveFloat(draft?.priceL);

    const sDiameter = parsePositiveInt(draft?.diameterS);
    const mDiameter = parsePositiveInt(draft?.diameterM);
    const lDiameter = parsePositiveInt(draft?.diameterL);

    const sizesCount = [sPrice, mPrice, lPrice].filter(Boolean).length;

    if (sizesCount === 0) {
      errors.push('❌ Vous devez renseigner au moins une taille de pizza');
      return { ok: false, errors };
    }

    // Prix strictement croissants quand les tailles existent.
    if (sPrice && mPrice && mPrice <= sPrice) {
      errors.push('❌ Le prix M doit être strictement supérieur au prix S');
    }
    if (mPrice && lPrice && lPrice <= mPrice) {
      errors.push('❌ Le prix L doit être strictement supérieur au prix M');
    }
    if (sPrice && lPrice && lPrice <= sPrice) {
      errors.push('❌ Le prix L doit être strictement supérieur au prix S');
    }

    // Diamètres strictement croissants quand renseignés.
    if (sDiameter && mDiameter && mDiameter <= sDiameter) {
      errors.push('❌ Le diamètre M doit être strictement supérieur au diamètre S');
    }
    if (mDiameter && lDiameter && lDiameter <= mDiameter) {
      errors.push('❌ Le diamètre L doit être strictement supérieur au diamètre M');
    }
    if (sDiameter && lDiameter && lDiameter <= sDiameter) {
      errors.push('❌ Le diamètre L doit être strictement supérieur au diamètre S');
    }

    // Chaque prix exige un diamètre.
    if (sPrice && !sDiameter) errors.push('❌ Le diamètre S est obligatoire si vous renseignez un prix S');
    if (mPrice && !mDiameter) errors.push('❌ Le diamètre M est obligatoire si vous renseignez un prix M');
    if (lPrice && !lDiameter) errors.push('❌ Le diamètre L est obligatoire si vous renseignez un prix L');

    return { ok: errors.length === 0, errors };
  }

  // Boissons à tailles: on attend une taille sélectionnée et un prix valide.
  if (type === 'soda' || type === 'eau' || type === 'biere') {
    const selectedSize = (draft?.selectedDrinkSize || '').trim();
    if (!selectedSize) {
      errors.push('❌ Vous devez sélectionner une taille');
      return { ok: false, errors };
    }

    const priceRaw = draft?.drinkSizes?.[selectedSize];
    const price = parsePositiveFloat(priceRaw);
    if (!price) {
      errors.push('❌ Vous devez renseigner un prix valide pour la taille sélectionnée');
      return { ok: false, errors };
    }

    return { ok: true, errors: [] };
  }

  // Vin / dessert / calzone : prix unique.
  if (type === 'vin' || type === 'dessert' || type === 'calzone') {
    const price = parsePositiveFloat(draft?.priceS);
    if (!price) {
      errors.push('❌ Vous devez renseigner un prix valide');
      return { ok: false, errors };
    }

    return { ok: true, errors: [] };
  }

  // Autres: prix unique (si applicable). Si pas de règle, on laisse passer.
  return { ok: true, errors: [] };
}
