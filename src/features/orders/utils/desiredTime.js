const TIME_RE = /^\d{2}:\d{2}$/;

export function formatHHMM(date) {
  if (!(date instanceof Date)) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function timeToMinutes(value) {
  if (!TIME_RE.test(value || '')) return NaN;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

export function getDateForTime(baseDate, time) {
  if (!(baseDate instanceof Date) || !TIME_RE.test(time || '')) return null;
  const [h, m] = time.split(':').map(Number);
  const out = new Date(baseDate);
  out.setHours(h, m, 0, 0);
  return out;
}

function getDeliveryExtraMinutes(deliveryMethod, deliveryExtraMinutes) {
  switch (deliveryMethod) {
    case 'delivery':
      return deliveryExtraMinutes;
    case 'pickup':
    default:
      return 0;
  }
}

export function getMinDesiredTime({
  now = new Date(),
  pizzaCount = 0,
  deliveryMethod = 'pickup',
  baseLeadMinutes = 0,
  perPizzaMinutes = 5,
  deliveryExtraMinutes = 15,
} = {}) {
  const safePizzaCount = Number.isFinite(pizzaCount) ? Math.max(0, pizzaCount) : 0;
  const prepMinutes = safePizzaCount * perPizzaMinutes;
  const deliveryExtra = getDeliveryExtraMinutes(deliveryMethod, deliveryExtraMinutes);
  const totalMinutes = baseLeadMinutes + prepMinutes + deliveryExtra;

  const minDate = new Date(now);
  minDate.setMinutes(minDate.getMinutes() + totalMinutes);

  return {
    minDate,
    minTime: formatHHMM(minDate),
    totalMinutes,
  };
}

export function validateDesiredTime({
  value,
  now = new Date(),
  minDate,
  openingHours,
  getTodayOpeningHours,
}) {
  if (!TIME_RE.test(value || '')) {
    return { ok: false, error: "Heure invalide" };
  }

  const selectedDate = getDateForTime(now, value);
  if (!selectedDate) {
    return { ok: false, error: "Heure invalide" };
  }

  if (selectedDate < now) {
    return { ok: false, error: "L'heure souhaitée ne peut pas être dans le passé" };
  }

  if (minDate instanceof Date && selectedDate < minDate) {
    return {
      ok: false,
      error: `L'heure souhaitée doit être au moins ${formatHHMM(minDate)}`,
    };
  }

  if (typeof getTodayOpeningHours === 'function') {
    const today = getTodayOpeningHours(openingHours, now);
    if (today) {
      if (!today.enabled) {
        return { ok: false, error: "Le camion est fermé aujourd'hui" };
      }

      if (today.open && today.close) {
        const openDate = getDateForTime(now, today.open);
        const closeDate = getDateForTime(now, today.close);
        if (openDate && closeDate) {
          if (selectedDate < openDate || selectedDate >= closeDate) {
            return {
              ok: false,
              error: `Hors horaires d'ouverture (${today.open} - ${today.close})`,
            };
          }
        }
      }
    }
  }

  return { ok: true, error: '' };
}

export function maxTime(a, b) {
  const aMin = timeToMinutes(a);
  const bMin = timeToMinutes(b);
  if (!Number.isFinite(aMin)) return b;
  if (!Number.isFinite(bMin)) return a;
  return aMin >= bMin ? a : b;
}
