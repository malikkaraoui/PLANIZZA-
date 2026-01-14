import { Clock, User, CheckCircle, ChefHat, Store, Bike, CreditCard, GripVertical } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';

/**
 * OrderCard - Composant d'affichage d'une commande
 * 
 * @param {Object} props
 * @param {Object} props.order - Données de la commande
 * @param {Object} props.statusConfig - Configuration du statut (label, color, icon)
 * @param {string} props.elapsed - Temps écoulé formaté (ex: "45s")
 * @param {Object} props.remaining - Temps restant {text: "5min", isLate: false}
 * @param {string} props.estimatedDeliveryTime - Heure de livraison prévue formatée (HH:MM)
 * @param {Function} props.onAccept - Callback pour prendre en charge
 * @param {Function} props.onDeliver - Callback pour délivrer
 * @param {Function} props.onMarkPaid - Callback pour marquer comme payé
 * @param {Function} props.onClick - Callback au clic sur la carte
 * @param {boolean} props.updating - État de mise à jour en cours
 * @param {string} props.borderVariant - Variante de bordure: 'default' | 'paid' | 'unpaid'
 */
export function OrderCard({
  order,
  statusConfig,
  elapsed,
  remaining,
  estimatedDeliveryTime,
  onAccept,
  onDeliver,
  onMarkPaid,
  onClick,
  updating = false,
  borderVariant = 'default'
}) {
  console.log('[OrderCard] Render', {
    orderId: order.id,
    status: order.status,
    paymentStatus: order.payment?.paymentStatus,
    borderVariant,
    estimatedDeliveryTime
  });

  // Déterminer les classes de bordure selon la variante
  const getBorderClasses = () => {
    switch (borderVariant) {
      case 'paid':
        return 'border-l-4 border-l-green-500';
      case 'unpaid':
        return 'border-l-4 border-l-orange-500';
      default:
        return '';
    }
  };

  const items = Array.isArray(order.items) ? order.items : [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  const linesCount = items.length;
  const calzoneQty = items.reduce(
    (sum, it) => sum + (/calzone/i.test(String(it.name || '')) ? Number(it.qty || 0) : 0),
    0
  );
  const pizzaLikeQty = Math.max(0, totalQty - calzoneQty);
  const previewNames = items
    .slice(0, 2)
    .map((it) => it?.name)
    .filter(Boolean)
    .join(' • ');

  return (
    <Card
      key={order.id}
      className={`glass-premium glass-glossy ${
        order.source === 'manual' 
          ? 'border-purple-500/50 bg-purple-500/5' 
          : 'border-white/20'
      } relative p-3 sm:p-4 rounded-[20px] ${
        remaining?.isLate ? 'border-red-500/50' : ''
      } ${getBorderClasses()}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {/* Poignée de drag (réordonnancement) */}
      <button
        type="button"
        data-dnd-handle
        onClick={(e) => e.stopPropagation()}
        className="absolute right-2 top-2 inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/15 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Réordonner la commande"
        title="Glisser pour réordonner"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        {/* Contenu (preview) */}
        <div className="min-w-0 flex-1">
          {/* Ligne badges */}
          <div className="flex items-center gap-1.5 flex-wrap pr-10">
            {order.status !== 'accepted' && (
              <Badge className={`${statusConfig.color} text-white rounded-full text-[11px] px-2 py-0.5`}>
                {statusConfig.label}
              </Badge>
            )}

            {order.payment?.provider === 'stripe' && (
              <Badge className="bg-emerald-600/90 text-white rounded-full text-[11px] px-2 py-0.5 font-bold flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                En ligne
              </Badge>
            )}

            {order.source === 'manual' && (
              <Badge className="bg-purple-600/90 text-white rounded-full text-[11px] px-2 py-0.5 font-bold">
                Manuel
              </Badge>
            )}

            {order.status === 'received' && (
              order.deliveryMethod === 'delivery' ? (
                <Badge className="bg-blue-600 text-white rounded-full text-[11px] px-2 py-0.5 font-bold flex items-center gap-1">
                  <Bike className="h-3 w-3" />
                  Livraison
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 text-white rounded-full text-[11px] px-2 py-0.5 font-bold flex items-center gap-1">
                  <Store className="h-3 w-3" />
                  Retrait
                </Badge>
              )
            )}
          </div>

          {/* Client */}
          <div className="mt-2 flex items-center gap-2 min-w-0">
            <User className="h-4 w-4 text-primary shrink-0" />
            <span className="font-black text-primary text-base truncate">
              {order.customerName || 'Client'}
            </span>
          </div>

          {/* Heure prévue */}
          {estimatedDeliveryTime && (
            <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border border-orange-500/25 bg-orange-500/10 text-orange-600">
              <Clock className="h-4 w-4" />
              <span className="font-black text-sm">{estimatedDeliveryTime}</span>
              <span className="text-[11px] font-bold opacity-80">
                {order.pickupTime ? 'Retrait' : 'Estimé'}
              </span>
            </div>
          )}

          {/* Preview contenu */}
          <div className="mt-2 text-xs text-muted-foreground font-semibold">
            {calzoneQty > 0
              ? `${pizzaLikeQty} pizza(s) • ${calzoneQty} calzone(s)`
              : `${totalQty} pizza(s)`}
            {linesCount > 0 ? ` • ${linesCount} ligne(s)` : ''}
          </div>
          {previewNames ? (
            <div className="mt-1 text-xs text-muted-foreground/80 truncate">
              {previewNames}{items.length > 2 ? '…' : ''}
            </div>
          ) : null}
        </div>

        {/* Colonne droite: chrono + actions */}
        <div className="shrink-0 w-28 flex flex-col items-end gap-2">
          {/* Timer */}
          <div className="text-right">
            {order.status === 'received' ? (
              <div>
                <div className={`text-2xl font-black ${
                  parseInt(elapsed) >= 60 
                    ? 'text-red-500'
                    : 'text-orange-500'
                }`}>
                  {elapsed}
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Chrono</div>
              </div>
            ) : remaining ? (
              <div>
                <div className={`text-2xl font-black ${remaining.isLate ? 'text-red-500' : 'text-emerald-500'}`}>
                  {remaining.text}
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">
                  {remaining.isLate ? 'Retard' : 'Restant'}
                </div>
              </div>
            ) : (
              <div className="text-xl font-black text-muted-foreground">{elapsed}</div>
            )}
          </div>

          {/* Actions (compact) */}
          <div className="w-full flex flex-col gap-2">
            {order.source === 'manual' && order.payment?.paymentStatus !== 'paid' && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkPaid?.(order.id);
                }}
                disabled={updating}
                className="w-full rounded-lg h-9 font-black text-xs bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                PAYÉ
              </Button>
            )}

            {order.status === 'received' ? (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept?.(order.id);
                }}
                disabled={updating}
                className="w-full rounded-lg h-9 font-bold text-xs bg-blue-500 hover:bg-blue-600 text-white"
              >
                <ChefHat className="h-4 w-4 mr-1" />
                Prendre
              </Button>
            ) : (
              !(order.source === 'manual' && order.payment?.paymentStatus !== 'paid') && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeliver?.(order.id);
                  }}
                  disabled={updating}
                  className="w-full rounded-lg h-9 font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {order.deliveryMethod === 'delivery' ? 'Livré' : 'Délivré'}
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
