/**
 * Helpers centralisés pour l'affichage et la logique de statut des commandes.
 * Utiliser un switch pour les mappings discrets (règle projet).
 */

export function getOrderStatusLabel(status) {
  switch (status) {
    case 'received':
      return 'Non prise en charge';
    case 'accepted':
      return 'En préparation';
    case 'ready':
      return 'Prête !';
    case 'delivered':
      return 'Remise';
    case 'cancelled':
      return 'Annulée';
    default:
      return String(status || 'Inconnu');
  }
}

export function getOrderStatusColor(status) {
  switch (status) {
    case 'received':
      return 'bg-orange-500';
    case 'accepted':
      return 'bg-blue-500';
    case 'ready':
      return 'bg-amber-500';
    case 'delivered':
      return 'bg-emerald-500';
    case 'cancelled':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

export function isOrderPaid(order) {
  if (!order) return false;
  return order?.payment?.paymentStatus === 'paid' || order?.v2?.paymentStatus === 'PAID';
}
