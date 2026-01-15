import { Clock, User, CheckCircle, ChefHat, CreditCard, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { coalesceMs, toMs } from '../../../lib/timestamps';

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
  statusConfig: _statusConfig,
  elapsed: _elapsed,
  remaining,
  estimatedDeliveryTime,
  onAccept,
  onDeliver,
  onMarkPaid,
  onClick,
  expanded = false,
  onToggleExpanded,
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
  const isAccepted = order.status === 'accepted';
  const leftBorderClass = isAccepted ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-orange-500';

  const isPaid = order.payment?.paymentStatus === 'paid';
  const paymentDotClass = isPaid ? 'bg-emerald-500' : 'bg-red-500';

  const isManual = order.source === 'manual';
  const isOnline = order.payment?.provider === 'stripe';
  const topBorderClass = isManual
    ? 'border-t-4 border-t-purple-500'
    : isOnline
      ? 'border-t-4 border-t-yellow-400'
      : '';

  const items = Array.isArray(order.items) ? order.items : [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  const calzoneQty = items.reduce(
    (sum, it) => sum + (/calzone/i.test(String(it.name || '')) ? Number(it.qty || 0) : 0),
    0
  );
  const pizzaLikeQty = Math.max(0, totalQty - calzoneQty);

  const createdAtMs = coalesceMs(order?.createdAt, order?.createdAtClient, 0) || 0;
  const acceptedAtMs = toMs(order?.timeline?.acceptedAt);
  const readyAtMs = toMs(order?.timeline?.readyAt);
  const deliveredAtMs = toMs(order?.timeline?.deliveredAt);

  const handleToggle = () => {
    onToggleExpanded?.();
    if (!onToggleExpanded) onClick?.();
  };

  const shortId = order?.id ? `#${String(order.id).slice(-6).toUpperCase()}` : '';

  return (
    <Card
      key={order.id}
      className={`glass-premium glass-glossy ${
        order.source === 'manual' 
          ? 'border-purple-500/50 bg-purple-500/5' 
          : 'border-white/20'
      } relative p-3 pb-12 pr-20 sm:p-4 sm:pb-14 sm:pr-24 lg:p-2.5 lg:pb-11 lg:pr-20 rounded-4xl transition-all ${leftBorderClass} ${topBorderClass} ${
        remaining?.isLate ? 'border-red-500/50' : ''
      }`}
      onClick={handleToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }}
    >
      {/* Poignée de drag (réordonnancement) */}
      <button
        type="button"
        data-dnd-handle
        onClick={(e) => e.stopPropagation()}
        className="absolute right-2 top-2 lg:right-1 lg:top-1 inline-flex items-center justify-center h-8 w-8 lg:h-7 lg:w-7 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/15 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Réordonner la commande"
        title="Glisser pour réordonner"
      >
        <GripVertical className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
      </button>

      {/* Bouton expand/collapse */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        className="absolute right-11 top-2 lg:right-9 lg:top-1 inline-flex items-center justify-center h-8 w-8 lg:h-7 lg:w-7 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/15 text-muted-foreground hover:text-foreground"
        aria-label={expanded ? 'Réduire les détails' : 'Afficher les détails'}
        title={expanded ? 'Réduire' : 'Détails'}
      >
        {expanded ? <ChevronUp className="h-4 w-4 lg:h-3.5 lg:w-3.5" /> : <ChevronDown className="h-4 w-4 lg:h-3.5 lg:w-3.5" />}
      </button>

      <div className="grid grid-cols-1 gap-3 items-start">
        {/* Colonne gauche: client + meta */}
        <div className="min-w-0 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-4 w-4 lg:h-3.5 lg:w-3.5 text-primary shrink-0" />
            <span className="font-black text-primary text-base lg:text-sm truncate">
              {order.customerName || 'Client'}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-3 text-sm lg:text-xs font-black text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              {pizzaLikeQty > 0 ? (
                <span>
                  {pizzaLikeQty} <span aria-label="pizzas">🍕</span>
                </span>
              ) : null}
              {calzoneQty > 0 ? (
                <span>
                  {calzoneQty} <span aria-label="calzones">🥟</span>
                </span>
              ) : null}
              {pizzaLikeQty === 0 && calzoneQty === 0 ? <span>—</span> : null}
            </span>
          </div>

          {/* Heure estimée (à gauche, sous le nombre de pizzas) */}
          <div className="mt-1 leading-none">
            <div className={`text-lg lg:text-base font-black ${remaining?.isLate ? 'text-red-500' : 'text-orange-600'}`}
            >
              {estimatedDeliveryTime || '—'}
            </div>
            {!order.pickupTime ? (
              <div className="mt-0.5 text-[10px] font-bold text-muted-foreground uppercase inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Livraison</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Actions (toujours en bas à droite) */}
      <div className="absolute bottom-2 right-2 lg:bottom-1 lg:right-1 flex items-center gap-1">
        {order.source === 'manual' && order.payment?.paymentStatus !== 'paid' ? (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onMarkPaid?.(order.id);
            }}
            disabled={updating}
            className="group h-8 w-8 lg:h-7 lg:w-7 hover:w-24 focus-visible:w-24 lg:hover:w-20 lg:focus-visible:w-20 overflow-hidden rounded-lg bg-red-600 hover:bg-red-700 text-white transition-[width] duration-200 ease-out px-0 hover:px-3 focus-visible:px-3 flex items-center justify-center hover:justify-start focus-visible:justify-start gap-0 hover:gap-2 focus-visible:gap-2"
            aria-label="Marquer comme payé"
            title="Payé"
          >
            <CreditCard className="h-4 w-4 shrink-0" />
            <span className="hidden group-hover:inline group-focus-visible:inline text-[11px] font-black whitespace-nowrap">
              Payé
            </span>
          </Button>
        ) : null}

        {order.status === 'received' ? (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onAccept?.(order.id);
            }}
            disabled={updating}
            className="group h-8 w-8 lg:h-7 lg:w-7 hover:w-24 focus-visible:w-24 lg:hover:w-20 lg:focus-visible:w-20 overflow-hidden rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-[width] duration-200 ease-out px-0 hover:px-3 focus-visible:px-3 flex items-center justify-center hover:justify-start focus-visible:justify-start gap-0 hover:gap-2 focus-visible:gap-2"
            aria-label="Prendre en charge"
            title="Prendre"
          >
            <ChefHat className="h-4 w-4 shrink-0" />
            <span className="hidden group-hover:inline group-focus-visible:inline text-[11px] font-black whitespace-nowrap">
              Prendre
            </span>
          </Button>
        ) : (
          !(order.source === 'manual' && order.payment?.paymentStatus !== 'paid') ? (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDeliver?.(order.id);
              }}
              disabled={updating}
              className="group h-8 w-8 lg:h-7 lg:w-7 hover:w-28 focus-visible:w-28 lg:hover:w-24 lg:focus-visible:w-24 overflow-hidden rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-[width] duration-200 ease-out px-0 hover:px-3 focus-visible:px-3 flex items-center justify-center hover:justify-start focus-visible:justify-start gap-0 hover:gap-2 focus-visible:gap-2"
              aria-label={order.deliveryMethod === 'delivery' ? 'Marquer comme livré' : 'Marquer comme délivré'}
              title={order.deliveryMethod === 'delivery' ? 'Livré' : 'Délivré'}
            >
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="hidden group-hover:inline group-focus-visible:inline text-[11px] font-black whitespace-nowrap">
                Délivrer
              </span>
            </Button>
          ) : null
        )}
      </div>

      {/* Pastille paiement (preview) */}
      <div
        className={`absolute left-2 top-2 lg:left-1 lg:top-1 h-2.5 w-2.5 rounded-full ${paymentDotClass}`}
        aria-label={isPaid ? 'Payée' : 'Non payée'}
        title={isPaid ? 'Payée' : 'Non payée'}
      />

      {/* DÉTAILS (inline, sans pop-up) */}
      {expanded ? (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
          {shortId ? (
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground font-bold">Commande</div>
              <div className="text-sm font-black">{shortId}</div>
            </div>
          ) : null}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground font-bold">Créée</div>
              <div className="text-sm font-bold">
                {createdAtMs ? new Date(createdAtMs).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground font-bold">Paiement</div>
              <div className="text-sm font-bold flex items-center gap-2">
                {order.payment?.provider === 'stripe' ? (
                  <>
                    <CreditCard className="h-4 w-4 text-emerald-500" />
                    <span>En ligne</span>
                    <Badge className="bg-emerald-600/90 text-white rounded-full text-[11px] px-2 py-0.5">
                      {order.payment?.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
                    </Badge>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 text-purple-500" />
                    <span>Manuel</span>
                    <Badge className="bg-purple-600/90 text-white rounded-full text-[11px] px-2 py-0.5">
                      {order.payment?.paymentStatus === 'paid' ? 'Payé' : 'À payer'}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Articles (nom + ingrédients modifiés) */}
          <div className="space-y-2">
            <div className="text-[11px] text-muted-foreground font-bold">Articles</div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black text-sm truncate">
                        <span className="text-primary">{item.qty}x</span> {item.name}
                      </div>
                    </div>
                    {typeof item.priceCents === 'number' ? (
                      <div className="text-xs font-bold text-muted-foreground shrink-0">
                        {(((item.priceCents || 0) * (item.qty || 0)) / 100).toFixed(2)} €
                      </div>
                    ) : null}
                  </div>

                  {(item.removedIngredients?.length > 0 || item.addedIngredients?.length > 0) && (
                    <div className="mt-2 text-xs space-y-1">
                      {item.removedIngredients?.length > 0 && (
                        <div className="text-red-500 font-bold">
                          ➖ Sans: {item.removedIngredients.join(', ')}
                        </div>
                      )}
                      {item.addedIngredients?.length > 0 && (
                        <div className="text-green-500 font-bold">
                          ➕ Avec: {item.addedIngredients.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="text-[11px] text-muted-foreground font-bold">Total</div>
            <div className="text-lg font-black text-primary">
              {typeof order.totalCents === 'number' ? `${(order.totalCents / 100).toFixed(2)} €` : '—'}
            </div>
          </div>

          {/* Timeline (simple) */}
          {(acceptedAtMs || readyAtMs || deliveredAtMs) ? (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="text-[11px] text-muted-foreground font-bold">Chronologie</div>
              <div className="grid sm:grid-cols-3 gap-2 text-xs">
                {acceptedAtMs ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="font-bold">Acceptée</span>
                    <span className="text-muted-foreground font-bold">{new Date(acceptedAtMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ) : null}
                {readyAtMs ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="font-bold">Prête</span>
                    <span className="text-muted-foreground font-bold">{new Date(readyAtMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ) : null}
                {deliveredAtMs ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="font-bold">Délivrée</span>
                    <span className="text-muted-foreground font-bold">{new Date(deliveredAtMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
