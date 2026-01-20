import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Check, Flame, Handshake, X, CreditCard } from 'lucide-react';

import { ROUTES } from '../../app/routes';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePizzaioloTruckId } from '../../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { useTruckOrders } from '../../features/orders/hooks/useTruckOrders';
import { pizzaioloMarkOrderPaid, pizzaioloTransitionOrderV2 } from '../../lib/ordersApi';
import { useServerNow } from '../../hooks/useServerNow';

import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import BackButton from '../../components/ui/BackButton';

import { legacyToOrderV2 } from '../../features/orders/v2/adapters/legacyToV2';

function formatHm(ms) {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(kitchenStatus) {
  switch (kitchenStatus) {
    case 'NEW':
      return 'Nouvelles';
    case 'QUEUED':
      return 'En file';
    case 'PREPPING':
      return 'En prep';
    case 'READY':
      return 'Prêtes';
    case 'HANDOFF':
      return 'Remise';
    case 'DONE':
      return 'Terminées';
    case 'CANCELED':
      return 'Annulées';
    case 'EXPIRED':
      return 'Expirées';
    default:
      return kitchenStatus;
  }
}

function timerText(promisedAtMs, nowMs) {
  if (!Number.isFinite(promisedAtMs) || !Number.isFinite(nowMs)) return { text: '—', isLate: false };
  const diff = promisedAtMs - nowMs;
  const absSec = Math.floor(Math.abs(diff) / 1000);
  if (absSec < 60) {
    return { text: `${absSec}s`, isLate: diff < 0 };
  }
  const absMin = Math.floor(absSec / 60);
  return { text: `${absMin}min`, isLate: diff < 0 };
}

function v2FromOrderLegacy(order) {
  const embedded = order?.v2;
  if (embedded && typeof embedded === 'object' && typeof embedded.kitchenStatus === 'string') {
    // Normaliser ms si manquants
    const promisedAtMs =
      typeof embedded.promisedAtMs === 'number'
        ? embedded.promisedAtMs
        : embedded.promisedAt
          ? new Date(embedded.promisedAt).getTime()
          : undefined;

    const createdAtMs =
      typeof embedded.createdAtMs === 'number'
        ? embedded.createdAtMs
        : embedded.createdAt
          ? new Date(embedded.createdAt).getTime()
          : undefined;

    return {
      ...embedded,
      id: order.id,
      promisedAtMs,
      createdAtMs,
    };
  }

  return legacyToOrderV2({ id: order.id, legacy: order });
}

function sortCanon(a, b) {
  const ap = typeof a.promisedAtMs === 'number' ? a.promisedAtMs : new Date(a.promisedAt).getTime();
  const bp = typeof b.promisedAtMs === 'number' ? b.promisedAtMs : new Date(b.promisedAt).getTime();
  if (ap !== bp) return ap - bp;

  const ac = typeof a.createdAtMs === 'number' ? a.createdAtMs : new Date(a.createdAt).getTime();
  const bc = typeof b.createdAtMs === 'number' ? b.createdAtMs : new Date(b.createdAt).getTime();
  return ac - bc;
}

function primaryActionFor(orderV2) {
  switch (orderV2.kitchenStatus) {
    case 'NEW':
      return { label: 'Accepter', action: 'ACCEPT', icon: Check };
    case 'QUEUED':
      return { label: 'Démarrer', action: 'START', icon: Flame };
    case 'PREPPING':
      return { label: 'Prête', action: 'READY', icon: Check };
    case 'READY':
      return { label: 'Remise', action: 'HANDOFF', icon: Handshake };
    case 'HANDOFF':
      return { label: 'Terminer', action: 'DONE', icon: Check };
    default:
      return null;
  }
}

function OrderMiniCard({ orderLegacy, orderV2, nowMs, onAdvance, onCancel, onMarkPaid, busy }) {
  const isPaid = orderV2.paymentStatus === 'PAID' || orderLegacy?.payment?.paymentStatus === 'paid';
  const totalPizzas = Array.isArray(orderLegacy?.items)
    ? orderLegacy.items.reduce((sum, it) => sum + Number(it?.qty || 0), 0)
    : 0;

  const promisedAtMs = typeof orderV2.promisedAtMs === 'number' ? orderV2.promisedAtMs : new Date(orderV2.promisedAt).getTime();
  const t = timerText(promisedAtMs, nowMs);
  const ActionIcon = t.isLate ? Clock : Clock;

  const primary = primaryActionFor(orderV2);
  const expectedUpdatedAtMs = typeof orderV2.updatedAtMs === 'number' ? orderV2.updatedAtMs : undefined;

  return (
    <Card className="rounded-2xl border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate font-semibold">
              {orderLegacy?.customerName || orderV2.customer?.name || 'Client'}
            </div>
            <Badge className={isPaid ? 'bg-emerald-600/90 text-white' : 'bg-orange-600/90 text-white'}>
              {isPaid ? 'Payé' : 'À encaisser'}
            </Badge>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
            <span className="inline-flex items-center gap-1">
              <ActionIcon className={t.isLate ? 'h-3.5 w-3.5 text-red-300' : 'h-3.5 w-3.5 text-emerald-300'} />
              <span className={t.isLate ? 'text-red-200' : 'text-emerald-200'}>{t.text}</span>
              <span className="text-white/50">(promesse {formatHm(promisedAtMs)})</span>
            </span>
            {totalPizzas > 0 ? <span>{totalPizzas} pizza(s)</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {primary ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onAdvance(orderLegacy.id, primary.action, expectedUpdatedAtMs)}
              className="h-8 rounded-xl"
              title={primary.label}
            >
              <primary.icon className="mr-2 h-4 w-4" />
              {primary.label}
            </Button>
          ) : null}

          <div className="flex items-center gap-2">
            {!isPaid ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => onMarkPaid(orderLegacy.id)}
                className="h-8 rounded-xl"
                title="Marquer payé"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Payé
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onCancel(orderLegacy.id, expectedUpdatedAtMs)}
              className="h-8 rounded-xl text-white/70 hover:text-white"
              title="Annuler"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-white/40">
        <span className="font-mono">{orderLegacy.id}</span>
      </div>
    </Card>
  );
}

function Column({ title, orders, nowMs, onAdvance, onCancel, onMarkPaid, busy }) {
  return (
    <div className="flex min-w-65 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <Badge className="bg-white/10 text-white/80">{orders.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/50">
            Rien pour l’instant.
          </div>
        ) : (
          orders.map(({ legacy, v2 }) => (
            <OrderMiniCard
              key={legacy.id}
              orderLegacy={legacy}
              orderV2={v2}
              nowMs={nowMs}
              onAdvance={onAdvance}
              onCancel={onCancel}
              onMarkPaid={onMarkPaid}
              busy={busy}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function PizzaioloOrdersV2() {
  const { user } = useAuth();
  const { truckId, loading: loadingTruckId } = usePizzaioloTruckId(user?.uid);
  const { orders, loading: ordersLoading } = useTruckOrders(truckId);
  const { nowMs } = useServerNow({ tickMs: 1000 });
  const [mutating, setMutating] = useState(false);

  const rows = useMemo(() => {
    return (orders || []).map((o) => {
      const v2 = v2FromOrderLegacy(o);
      return { legacy: o, v2 };
    });
  }, [orders]);

  const byStatus = useMemo(() => {
    const buckets = {
      NEW: [],
      QUEUED: [],
      PREPPING: [],
      READY: [],
      HANDOFF: [],
      DONE: [],
      CANCELED: [],
      EXPIRED: [],
    };

    for (const row of rows) {
      const ks = row?.v2?.kitchenStatus;
      if (ks && buckets[ks]) buckets[ks].push(row);
      else buckets.NEW.push(row);
    }

    for (const key of Object.keys(buckets)) {
      buckets[key].sort((a, b) => sortCanon(a.v2, b.v2));
    }

    return buckets;
  }, [rows]);

  const busy = Boolean(loadingTruckId || ordersLoading || mutating);

  const onAdvance = async (orderId, action, expectedUpdatedAtMs) => {
    try {
      setMutating(true);
      await pizzaioloTransitionOrderV2({ orderId, action, expectedUpdatedAtMs });
    } finally {
      setMutating(false);
    }
  };

  const onCancel = async (orderId, expectedUpdatedAtMs) => {
    try {
      setMutating(true);
      await pizzaioloTransitionOrderV2({
        orderId,
        action: 'CANCEL',
        expectedUpdatedAtMs,
      });
    } finally {
      setMutating(false);
    }
  };

  const onMarkPaid = async (orderId) => {
    try {
      setMutating(true);
      await pizzaioloMarkOrderPaid({ orderId, method: 'CASH' });
    } finally {
      setMutating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6">
        <BackButton />
      </div>
      
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-white">Commandes (v2)</div>
          <div className="text-xs text-white/60">
            Tri canonique: promesse ↑ puis création ↑ — garde-fou paiement côté serveur.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={ROUTES.pizzaioloOrders}>
            <Button variant="secondary" className="rounded-xl">Retour v1</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
        <div className="flex gap-3 overflow-x-auto pb-2">
          <Column
            title={statusLabel('NEW')}
            orders={byStatus.NEW}
            nowMs={nowMs}
            onAdvance={onAdvance}
            onCancel={onCancel}
            onMarkPaid={onMarkPaid}
            busy={busy}
          />
          <Column
            title={statusLabel('QUEUED')}
            orders={byStatus.QUEUED}
            nowMs={nowMs}
            onAdvance={onAdvance}
            onCancel={onCancel}
            onMarkPaid={onMarkPaid}
            busy={busy}
          />
          <Column
            title={statusLabel('PREPPING')}
            orders={byStatus.PREPPING}
            nowMs={nowMs}
            onAdvance={onAdvance}
            onCancel={onCancel}
            onMarkPaid={onMarkPaid}
            busy={busy}
          />
          <Column
            title={statusLabel('READY')}
            orders={byStatus.READY}
            nowMs={nowMs}
            onAdvance={onAdvance}
            onCancel={onCancel}
            onMarkPaid={onMarkPaid}
            busy={busy}
          />
          <Column
            title={statusLabel('HANDOFF')}
            orders={byStatus.HANDOFF}
            nowMs={nowMs}
            onAdvance={onAdvance}
            onCancel={onCancel}
            onMarkPaid={onMarkPaid}
            busy={busy}
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold text-white/90">Historique</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="mb-2 text-xs text-white/60">{statusLabel('DONE')}</div>
            <div className="flex flex-col gap-2">
              {byStatus.DONE.slice(0, 10).map(({ legacy, v2 }) => (
                <OrderMiniCard
                  key={legacy.id}
                  orderLegacy={legacy}
                  orderV2={v2}
                  nowMs={nowMs}
                  onAdvance={onAdvance}
                  onCancel={onCancel}
                  onMarkPaid={onMarkPaid}
                  busy={busy}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs text-white/60">{statusLabel('CANCELED')}</div>
            <div className="flex flex-col gap-2">
              {byStatus.CANCELED.slice(0, 10).map(({ legacy, v2 }) => (
                <OrderMiniCard
                  key={legacy.id}
                  orderLegacy={legacy}
                  orderV2={v2}
                  nowMs={nowMs}
                  onAdvance={onAdvance}
                  onCancel={onCancel}
                  onMarkPaid={onMarkPaid}
                  busy={busy}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs text-white/60">{statusLabel('EXPIRED')}</div>
            <div className="flex flex-col gap-2">
              {byStatus.EXPIRED.slice(0, 10).map(({ legacy, v2 }) => (
                <OrderMiniCard
                  key={legacy.id}
                  orderLegacy={legacy}
                  orderV2={v2}
                  nowMs={nowMs}
                  onAdvance={onAdvance}
                  onCancel={onCancel}
                  onMarkPaid={onMarkPaid}
                  busy={busy}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
