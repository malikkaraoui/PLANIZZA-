const SECTION_ORDER = ['pizzas', 'boissons', 'desserts', 'autres'];

function normalizeType(rawType) {
  const t = String(rawType || '').toLowerCase().trim();
  if (!t) return '';
  return t;
}

export function getCartSectionKey(item) {
  const t = normalizeType(item?.type ?? item?.genre ?? item?.family ?? item?.famille ?? item?.category);

  switch (t) {
    case 'pizza':
    case 'pizzas':
    case 'calzone':
    case 'calzones':
      return 'pizzas';

    // boissons (différents formats legacy/à venir)
    case 'boisson':
    case 'boissons':
    case 'drink':
    case 'beverage':
    case 'soda':
    case 'eau':
    case 'biere':
    case 'bière':
    case 'vin':
      return 'boissons';

    case 'dessert':
    case 'desserts':
      return 'desserts';

    default:
      return 'autres';
  }
}

export function getCartSectionLabel(sectionKey) {
  switch (sectionKey) {
    case 'pizzas':
      return 'Pizzas & calzones';
    case 'boissons':
      return 'Boissons';
    case 'desserts':
      return 'Desserts';
    default:
      return 'Autres';
  }
}

export function buildCartSections(items) {
  const list = Array.isArray(items) ? items : [];

  const buckets = new Map();
  for (const it of list) {
    const key = getCartSectionKey(it);
    const prev = buckets.get(key) || [];
    prev.push(it);
    buckets.set(key, prev);
  }

  return SECTION_ORDER
    .map((key) => {
      const sectionItems = buckets.get(key) || [];
      if (sectionItems.length === 0) return null;
      return {
        key,
        label: getCartSectionLabel(key),
        items: sectionItems,
      };
    })
    .filter(Boolean);
}
