/**
 * Vérifie si un camion est ouvert en fonction de ses horaires
 */
export function isCurrentlyOpen(openingHours) {
  if (!openingHours || typeof openingHours !== 'object') {
    return false;
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const daySchedule = openingHours[currentDay];

  // Si le jour n'est pas activé
  if (!daySchedule || !daySchedule.enabled) {
    return false;
  }

  // Obtenir l'heure actuelle en format HH:MM
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

  // Comparer les horaires
  const openTime = daySchedule.open || '00:00';
  const closeTime = daySchedule.close || '23:59';

  // Le camion est ouvert si l'heure actuelle est >= heure d'ouverture ET < heure de fermeture
  return currentTime >= openTime && currentTime < closeTime;
}

export function getTodayOpeningHours(openingHours, now = new Date()) {
  if (!openingHours || typeof openingHours !== 'object') {
    return null;
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const daySchedule = openingHours[currentDay];

  if (!daySchedule) {
    return {
      dayKey: currentDay,
      enabled: false,
      open: null,
      close: null,
    };
  }

  return {
    dayKey: currentDay,
    enabled: Boolean(daySchedule.enabled),
    open: daySchedule.open || null,
    close: daySchedule.close || null,
  };
}

export function isTimeWithinOpeningHours(time, openingHours, now = new Date()) {
  const today = getTodayOpeningHours(openingHours, now);
  if (!today) return null;
  if (!today.enabled) return false;
  if (!today.open || !today.close) return null;

  return time >= today.open && time < today.close;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Retourne la localisation du jour pour un truck.
 * Priorite : truck.locations[today] > truck.location (fallback)
 */
export function getTodayLocation(truck, now = new Date()) {
  if (!truck) return null;

  const currentDay = DAY_NAMES[now.getDay()];

  // Nouveau format : emplacements par jour
  if (truck.locations && typeof truck.locations === 'object') {
    const dayLocation = truck.locations[currentDay];
    if (dayLocation && dayLocation.lat && dayLocation.lng) {
      return dayLocation;
    }
  }

  // Fallback : ancien format unique
  if (truck.location && truck.location.lat && truck.location.lng) {
    return truck.location;
  }

  return null;
}

/**
 * Obtient le texte d'affichage pour le statut du camion
 */
export function getOpeningStatusText(openingHours) {
  if (!openingHours || typeof openingHours !== 'object') {
    return 'Horaires non renseignés';
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const daySchedule = openingHours[currentDay];

  if (!daySchedule || !daySchedule.enabled) {
    return 'Fermé aujourd\'hui';
  }

  const currentTime = now.toTimeString().slice(0, 5);
  const openTime = daySchedule.open || '00:00';
  const closeTime = daySchedule.close || '23:59';

  // Avant l'ouverture
  if (currentTime < openTime) {
    return `Ouvre à ${openTime}`;
  }

  // Après la fermeture
  if (currentTime >= closeTime) {
    return 'Fermé';
  }

  // Actuellement ouvert
  return `Ouvert jusqu'à ${closeTime}`;
}
