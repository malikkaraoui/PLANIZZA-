import { Clock, User, CheckCircle, ChefHat, Store, Bike, CreditCard } from 'lucide-react';
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

  return (
    <Card
      key={order.id}
      className={`glass-premium glass-glossy ${
        order.source === 'manual' 
          ? 'border-purple-500/50 bg-purple-500/5' 
          : 'border-white/20'
      } p-6 rounded-[24px] ${
        remaining?.isLate ? 'border-red-500/50' : ''
      } ${getBorderClasses()}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="grid md:grid-cols-[1fr_auto_auto] gap-6 items-start">
        {/* Colonne 1: Informations commande */}
        <div className="space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Badge Statut (seulement si pas "Prise en charge" car redondant dans section) */}
            {order.status !== 'accepted' && (
              <Badge className={`${statusConfig.color} text-white rounded-full text-xs`}>
                {statusConfig.label}
              </Badge>
            )}
            
            {/* Badge MANUELLE (seulement si commande payée, sinon évident) */}
            {order.source === 'manual' && order.payment?.paymentStatus === 'paid' && (
              <Badge className="bg-purple-600 text-white rounded-full text-xs font-bold">
                ✋ MANUELLE
              </Badge>
            )}
            
            {/* Badge Livraison/Retrait (uniquement si pas encore prise en charge) */}
            {order.status === 'received' && (
              order.deliveryMethod === 'delivery' ? (
                <Badge className="bg-blue-600 text-white rounded-full text-xs font-bold flex items-center gap-1">
                  <Bike className="h-3 w-3" />
                  LIVRAISON
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 text-white rounded-full text-xs font-bold flex items-center gap-1">
                  <Store className="h-3 w-3" />
                  RETRAIT
                </Badge>
              )
            )}
          </div>
          
          {/* Nom du client */}
          <div className="mb-3 px-4 py-2 bg-primary/20 rounded-xl inline-flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <span className="font-black text-primary text-lg">
              {order.customerName || 'Client'}
            </span>
          </div>

          {/* Heure de livraison prévue - FILE CONDUCTEUR */}
          {estimatedDeliveryTime && (
            <div className="mb-3 px-4 py-2 bg-linear-to-r from-orange-500/20 to-amber-500/20 rounded-xl inline-flex items-center gap-2 ml-2 border border-orange-500/30">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="font-black text-orange-500 text-lg">
                {estimatedDeliveryTime}
              </span>
              <span className="text-xs font-bold text-orange-500/70">
                {order.pickupTime ? 'Retrait prévu' : 'Prêt estimé'}
              </span>
            </div>
          )}

          {/* Liste des pizzas */}
          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">
                    {item.qty}x {item.name}
                  </span>
                </div>
                
                {/* Ingrédients modifiés */}
                {(item.removedIngredients?.length > 0 || item.addedIngredients?.length > 0) && (
                  <div className="text-sm pl-6 space-y-1">
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

        {/* Colonne 2: Actions */}
        <div className="flex flex-col gap-2" style={{ minWidth: '180px' }}>
          {/* Bouton PAYÉ (commandes manuelles non payées) */}
          {order.source === 'manual' && order.payment?.paymentStatus !== 'paid' && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                console.log('[OrderCard] Clic PAYÉ', order.id);
                onMarkPaid?.(order.id);
              }}
              disabled={updating}
              className="w-full rounded-xl h-14 font-black text-sm bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 animate-pulse shadow-lg shadow-red-500/50 border-2 border-red-400"
            >
              <CreditCard className="h-5 w-5" />
              💰 PAYÉ
            </Button>
          )}
          
          {/* Indicateur PAYÉ (commandes manuelles payées) */}
          {order.source === 'manual' && order.payment?.paymentStatus === 'paid' && (
            <div className="w-full px-4 py-2 rounded-xl bg-green-600/20 border-2 border-green-600 flex items-center justify-center gap-2">
              <span className="text-green-600 font-black text-sm">💵 PAYÉ</span>
            </div>
          )}
          
          {/* Boutons d'action selon statut */}
          {order.status === 'received' ? (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                console.log('[OrderCard] Clic Prendre en charge', order.id);
                onAccept?.(order.id);
              }}
              disabled={updating}
              className="w-full rounded-xl h-12 font-bold bg-blue-500 hover:bg-blue-600 text-white"
            >
              <ChefHat className="h-4 w-4 mr-2" />
              Prendre en charge
            </Button>
          ) : (
            // Bouton Délivré : uniquement si commande payée (ou non manuelle)
            !(order.source === 'manual' && order.payment?.paymentStatus !== 'paid') && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('[OrderCard] Clic Délivré', order.id);
                  onDeliver?.(order.id);
                }}
                disabled={updating}
                className="w-full rounded-xl h-12 font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {order.deliveryMethod === 'delivery' ? 'Livré' : 'Délivré'}
              </Button>
            )
          )}
        </div>

        {/* Colonne 3: Timer */}
        <div className="text-center" style={{ minWidth: '120px' }}>
          {order.status === 'received' ? (
            <div className="space-y-1">
              <div className={`text-4xl font-black ${
                parseInt(elapsed) >= 60 
                  ? 'text-red-500 animate-pulse'
                  : 'text-orange-500'
              }`}>
                {elapsed}
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase block">Chrono</span>
            </div>
          ) : remaining ? (
            <div className="space-y-1">
              <div className={`text-4xl font-black ${remaining.isLate ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                {remaining.text}
              </div>
              <span className="text-xs font-bold text-muted-foreground uppercase block">
                {remaining.isLate ? 'Retard' : 'Restant'}
              </span>
            </div>
          ) : (
            <div className="text-2xl font-black text-muted-foreground">{elapsed}</div>
          )}
        </div>
      </div>
    </Card>
  );
}
