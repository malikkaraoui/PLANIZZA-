import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../app/routes';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePizzaioloTruckId } from '../../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { useTruckOrders } from '../../features/orders/hooks/useTruckOrders';
import { useServerNow } from '../../hooks/useServerNow';
import { useAutoDismissMessage } from '../../hooks/useAutoDismissMessage';

import { legacyToOrderV2 } from '../../features/orders/v2/adapters/legacyToV2';
import { pizzaioloMarkOrderPaid, pizzaioloTransitionOrderV2 } from '../../lib/ordersApi';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const KITCHEN_STATUS_LABELS = Object.freeze({
  NEW: 'NOUVELLE',
  QUEUED: 'EN FILE',
  PREPPING: 'PRÉPARATION',
  READY: 'PRÊTE',
  HANDOFF: 'REMISE',
  DONE: 'TERMINÉE',
  CANCELED: 'ANNULÉE',
  EXPIRED: 'EXPIRÉE',
});

const PAYMENT_STATUS_LABELS = Object.freeze({
  PAID: 'PAYÉ',
  UNPAID: 'IMPAYÉ',
  ISSUE: 'PROBLÈME',
});

const FULFILLMENT_LABELS = Object.freeze({
  PICKUP: 'RETRAIT',
  DELIVERY: 'LIVRAISON',
});

function kitchenStatusLabel(v) {
  return KITCHEN_STATUS_LABELS[v] || String(v || '—');
}

function paymentStatusLabel(v) {
  return PAYMENT_STATUS_LABELS[v] || String(v || '—');
}

function fulfillmentLabel(v) {
  return FULFILLMENT_LABELS[v] || String(v || '—');
}

function formatHmFromMs(ms) {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function safeParseMs(iso) {
  if (typeof iso !== 'string') return NaN;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * @param {string} promisedAtISO
 * @param {number} nowMs
 * @returns {'LATE'|'DUE_SOON'|'UPCOMING'}
 */
function getTimeBucket(promisedAtISO, nowMs) {
  const p = safeParseMs(promisedAtISO);
  const diff = p - nowMs;
  if (!Number.isFinite(diff)) return 'UPCOMING';
  if (diff < 0) return 'LATE';
  if (diff <= 8 * 60 * 1000) return 'DUE_SOON';
  return 'UPCOMING';
}

/**
 * @param {string} promisedAtISO
 * @param {number} nowMs
 */
function getTimerLabel(promisedAtISO, nowMs) {
  const p = safeParseMs(promisedAtISO);
  if (!Number.isFinite(p) || !Number.isFinite(nowMs)) return '—';

  const diff = p - nowMs;
  const abs = Math.abs(diff);
  const mm = String(Math.floor(abs / 60000)).padStart(2, '0');
  const ss = String(Math.floor((abs % 60000) / 1000)).padStart(2, '0');
  return diff >= 0 ? `T-${mm}:${ss}` : `T+${mm}:${ss}`;
}

function v2FromOrderLegacy(order) {
  const embedded = order?.v2;
  if (embedded && typeof embedded === 'object' && typeof embedded.kitchenStatus === 'string') {
    const promisedAt = typeof embedded.promisedAt === 'string' ? embedded.promisedAt : undefined;
    const createdAt = typeof embedded.createdAt === 'string' ? embedded.createdAt : undefined;

    const promisedAtMs =
      typeof embedded.promisedAtMs === 'number'
        ? embedded.promisedAtMs
        : promisedAt
          ? safeParseMs(promisedAt)
          : undefined;

    const createdAtMs =
      typeof embedded.createdAtMs === 'number'
        ? embedded.createdAtMs
        : createdAt
          ? safeParseMs(createdAt)
          : undefined;

    const updatedAtMs = typeof embedded.updatedAtMs === 'number' ? embedded.updatedAtMs : undefined;

    return {
      ...embedded,
      id: order.id,
      promisedAtMs: Number.isFinite(promisedAtMs) ? promisedAtMs : undefined,
      createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : undefined,
      updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : undefined,
    };
  }

  return legacyToOrderV2({ id: order.id, legacy: order });
}

function sortCanon(a, b) {
  const ap = typeof a.promisedAtMs === 'number' ? a.promisedAtMs : safeParseMs(a.promisedAt);
  const bp = typeof b.promisedAtMs === 'number' ? b.promisedAtMs : safeParseMs(b.promisedAt);
  if (ap !== bp) return ap - bp;

  const ac = typeof a.createdAtMs === 'number' ? a.createdAtMs : safeParseMs(a.createdAt);
  const bc = typeof b.createdAtMs === 'number' ? b.createdAtMs : safeParseMs(b.createdAt);
  return ac - bc;
}

function actionsFor(orderV2, legacy) {
  const isPaid = orderV2.paymentStatus === 'PAID';
  const isManual = legacy?.payment?.provider === 'manual';

  /** @type {Array<{key: string, label: string, kind: 'transition'|'markPaid', nextKitchenStatus?: string, disabled?: boolean, title?: string}>} */
  const actions = [];

  switch (orderV2.kitchenStatus) {
    case 'NEW':
      actions.push({ key: 'accept', label: 'ACCEPTER', kind: 'transition', nextKitchenStatus: 'QUEUED' });
      actions.push({ key: 'cancel', label: 'ANNULER', kind: 'transition', nextKitchenStatus: 'CANCELED' });
      break;
    case 'QUEUED':
      actions.push({ key: 'start', label: 'DÉMARRER', kind: 'transition', nextKitchenStatus: 'PREPPING' });
      actions.push({ key: 'cancel', label: 'ANNULER', kind: 'transition', nextKitchenStatus: 'CANCELED' });
      break;
    case 'PREPPING':
      actions.push({ key: 'ready', label: 'PRÊTE', kind: 'transition', nextKitchenStatus: 'READY' });
      actions.push({ key: 'cancel', label: 'ANNULER', kind: 'transition', nextKitchenStatus: 'CANCELED' });
      break;
    case 'READY': {
      const disabled = !isPaid;
      actions.push({
        key: 'handoff',
        label: disabled ? 'REMETTRE (PAYER AVANT)' : 'REMETTRE',
        kind: 'transition',
        nextKitchenStatus: 'HANDOFF',
        disabled,
        title: disabled ? 'Paiement requis avant la remise.' : undefined,
      });
      actions.push({ key: 'cancel', label: 'ANNULER', kind: 'transition', nextKitchenStatus: 'CANCELED' });
      break;
    }
    case 'HANDOFF':
      actions.push({ key: 'done', label: 'TERMINER', kind: 'transition', nextKitchenStatus: 'DONE' });
      break;
    default:
      break;
  }

  // Optionnel (utile en prod): action "PAY" uniquement pour les commandes manuelles impayées.
  if (!isPaid && isManual && !actions.some((a) => a.kind === 'markPaid')) {
    // Garder max 3 actions (garder les 2 premières + PAY)
    if (actions.length >= 3) actions.length = 2;
    actions.push({ key: 'pay', label: 'ENCAISSER', kind: 'markPaid' });
  }

  return actions;
}

function TimeSection({ title, rows, emptyText }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3 px-2 py-1">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <Badge className="bg-white/10 text-white/80">{rows.length}</Badge>
      </div>
      <div className="mt-2">
        {rows.length === 0 ? (
          <div className="px-2 py-3 text-xs text-white/50">{emptyText}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {rows.map((row) => row.render())}
          </div>
        )}
      </div>
    </section>
  );
}

function OrderRow({ row, nowMs, busy, onAction }) {
  const { legacy, v2 } = row;

  const promisedMs = typeof v2.promisedAtMs === 'number' ? v2.promisedAtMs : safeParseMs(v2.promisedAt);
  const promisedHm = formatHmFromMs(promisedMs);
  const timer = getTimerLabel(v2.promisedAt, nowMs);

  const customer = legacy?.customerName || v2.customer?.name || 'Client';
  const itemsCount = Array.isArray(legacy?.items)
    ? legacy.items.reduce((sum, it) => sum + Number(it?.qty || 0), 0)
    : Array.isArray(v2.items)
      ? v2.items.reduce((sum, it) => sum + Number(it?.qty || 0), 0)
      : 0;

  const paymentRaw = v2.paymentStatus;
  const paymentText = paymentStatusLabel(paymentRaw);
  const payClass =
    paymentRaw === 'PAID'
      ? 'bg-emerald-600/90 text-white'
      : paymentRaw === 'ISSUE'
        ? 'bg-red-600/90 text-white'
        : 'bg-orange-600/90 text-white';

  const actionList = actionsFor(v2, legacy);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2">
      <div className="grid grid-cols-[64px_88px_86px_76px_92px_1fr_86px_auto] items-center gap-2 text-[12px]">
        <div className="font-mono text-white/90">{promisedHm}</div>
        <div className="font-mono text-white/80">{timer}</div>
        <div className="font-mono text-white/90">{kitchenStatusLabel(v2.kitchenStatus)}</div>
        <div>
          <span className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[11px] ${payClass}`}>{paymentText}</span>
        </div>
        <div className="font-mono text-white/80">{fulfillmentLabel(v2.fulfillment)}</div>
        <div className="truncate font-mono text-white/90">{customer}</div>
        <div className="font-mono text-white/70">items:{itemsCount}</div>
        <div className="flex flex-wrap justify-end gap-1">
          {actionList.map((a) => (
            <Button
              key={a.key}
              size="sm"
              variant={a.key === 'cancel' ? 'ghost' : 'secondary'}
              className={a.key === 'cancel' ? 'h-7 rounded-xl text-white/70 hover:text-white' : 'h-7 rounded-xl'}
              disabled={busy || Boolean(a.disabled)}
              title={a.title}
              onClick={() => onAction(a)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPageTimeDriven() {
  const { user } = useAuth();
  const { truckId, loading: loadingTruckId, error: truckIdError } = usePizzaioloTruckId(user?.uid);
  const { orders, loading: ordersLoading, error: ordersError } = useTruckOrders(truckId);
  const { nowMs } = useServerNow({ tickMs: 1000 });

  const [q, setQ] = useState('');
  const [mutating, setMutating] = useState(false);
  const [message, setMessage] = useState('');
  useAutoDismissMessage(message, setMessage, { delayMs: 5000, dismissErrors: false });

  const rows = useMemo(() => {
    const term = String(q || '').trim().toLowerCase();
    const base = (orders || []).map((legacy) => {
      const v2 = v2FromOrderLegacy(legacy);
      return { legacy, v2 };
    });

    if (!term) return base;

    return base.filter(({ legacy, v2 }) => {
      const hay = [
        legacy?.id,
        legacy?.customerName,
        v2?.customer?.name,
        v2?.kitchenStatus,
        kitchenStatusLabel(v2?.kitchenStatus),
        v2?.paymentStatus,
        paymentStatusLabel(v2?.paymentStatus),
        v2?.fulfillment,
        fulfillmentLabel(v2?.fulfillment),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return hay.includes(term);
    });
  }, [orders, q]);

  const active = useMemo(() => rows.filter((r) => !['DONE', 'CANCELED', 'EXPIRED'].includes(r.v2.kitchenStatus)), [rows]);
  const history = useMemo(() => rows.filter((r) => ['DONE', 'CANCELED', 'EXPIRED'].includes(r.v2.kitchenStatus)), [rows]);

  const buckets = useMemo(() => {
    const late = [];
    const dueSoon = [];
    const upcoming = [];

    for (const r of active) {
      const b = getTimeBucket(r.v2.promisedAt, nowMs);
      if (b === 'LATE') late.push(r);
      else if (b === 'DUE_SOON') dueSoon.push(r);
      else upcoming.push(r);
    }

    late.sort((a, b) => sortCanon(a.v2, b.v2));
    dueSoon.sort((a, b) => sortCanon(a.v2, b.v2));
    upcoming.sort((a, b) => sortCanon(a.v2, b.v2));

    return { late, dueSoon, upcoming };
  }, [active, nowMs]);

  const busy = Boolean(loadingTruckId || ordersLoading || mutating);

  const runAction = async (row, action) => {
    if (!row?.legacy?.id) return;

    try {
      setMutating(true);

      if (action.kind === 'markPaid') {
        await pizzaioloMarkOrderPaid({ orderId: row.legacy.id, method: 'CASH' });
        setMessage('✅ Paiement enregistré.');
        return;
      }

      if (action.kind === 'transition') {
        const expectedUpdatedAtMs = typeof row.v2.updatedAtMs === 'number' ? row.v2.updatedAtMs : undefined;
        
        // DEBUG: log l'état avant transition
        console.log('[OrdersTimeDriven] Transition:', {
          orderId: row.legacy.id,
          legacyStatus: row.legacy.status,
          v2KitchenStatus: row.v2.kitchenStatus,
          nextKitchenStatus: action.nextKitchenStatus,
          v2PaymentStatus: row.v2.paymentStatus,
          hasV2Embedded: Boolean(row.legacy.v2),
          expectedUpdatedAtMs,
        });
        
        await pizzaioloTransitionOrderV2({
          orderId: row.legacy.id,
          nextKitchenStatus: action.nextKitchenStatus,
          expectedUpdatedAtMs,
        });

        // Message ultra simple (v0)
        if (action.nextKitchenStatus === 'QUEUED') setMessage('✅ Commande acceptée.');
        else if (action.nextKitchenStatus === 'PREPPING') setMessage('✅ Préparation démarrée.');
        else if (action.nextKitchenStatus === 'READY') setMessage('✅ Commande prête.');
        else if (action.nextKitchenStatus === 'HANDOFF') setMessage('✅ Commande remise.');
        else if (action.nextKitchenStatus === 'DONE') setMessage('✅ Commande terminée.');
        else if (action.nextKitchenStatus === 'CANCELED') setMessage('✅ Commande annulée.');
      }
    } catch (err) {
      const status = err?.status;
      const apiErr = err?.details?.error;
      const apiReason = err?.details?.reason;

      if (status === 409 && apiErr === 'conflict') {
        setMessage('❌ Cette commande a été mise à jour ailleurs. Réessaie dans 1 seconde.');
        return;
      }
      if (status === 409 && apiErr === 'transition_refused') {
        setMessage(`❌ Action refusée${apiReason ? ` : ${apiReason}` : ''}.`);
        return;
      }

      setMessage(`❌ ${String(err?.message || err)}`);
    } finally {
      setMutating(false);
    }
  };

  if (loadingTruckId) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-white/70">Chargement…</div>
      </div>
    );
  }

  if (truckIdError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="rounded-3xl border border-red-500/20 bg-red-950/40 p-6 text-sm text-red-100">
          Erreur camion: {String(truckIdError?.message || truckIdError)}
        </div>
      </div>
    );
  }

  if (!truckId) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
          <div className="text-sm text-white/80">Vous devez d’abord créer un camion.</div>
          <div className="mt-3">
            <Link to={ROUTES.pizzaioloProfile}>
              <Button className="rounded-xl">Créer mon camion</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-bold text-white">File d’attente (Temps)</div>
          <div className="mt-1 text-xs text-white/60">
            maintenant: {formatHmFromMs(nowMs)} <span className="text-white/40">(tri global : promesse ↑)</span>
          </div>
        </div>

        <div className="flex min-w-56 items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="h-9 rounded-xl"
          />
        </div>
      </div>

      {(ordersError && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-950/40 p-3 text-xs text-red-100">
          Erreur commandes: {String(ordersError?.message || ordersError)}
        </div>
      )) || null}

      {message ? (
        <div
          className={`mb-4 rounded-2xl border p-3 text-xs ${
            message.startsWith('❌')
              ? 'border-red-500/20 bg-red-950/40 text-red-100'
              : 'border-emerald-500/20 bg-emerald-950/30 text-emerald-50'
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-3">
        <TimeSection
          title={`🟢 À VENIR`}
          rows={buckets.upcoming.map((row) => ({
            render: () => (
              <OrderRow
                key={row.legacy.id}
                row={row}
                nowMs={nowMs}
                busy={busy}
                onAction={(a) => runAction(row, a)}
              />
            ),
          }))}
          emptyText="Aucune commande à venir."
        />

        <TimeSection
          title={`🟠 À FAIRE MAINTENANT`}
          rows={buckets.dueSoon.map((row) => ({
            render: () => (
              <OrderRow
                key={row.legacy.id}
                row={row}
                nowMs={nowMs}
                busy={busy}
                onAction={(a) => runAction(row, a)}
              />
            ),
          }))}
          emptyText="Rien d’urgent pour l’instant."
        />

        <TimeSection
          title={`🔴 RETARD`}
          rows={buckets.late.map((row) => ({
            render: () => (
              <OrderRow
                key={row.legacy.id}
                row={row}
                nowMs={nowMs}
                busy={busy}
                onAction={(a) => runAction(row, a)}
              />
            ),
          }))}
          emptyText="Aucune commande en retard."
        />
      </div>

      <details className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer select-none px-2 py-1 text-sm font-semibold text-white/90">
          Historique (DONE / CANCELED / EXPIRED) <span className="text-white/60">[{history.length}]</span>
        </summary>
        <div className="mt-3 flex flex-col gap-1">
          {history
            .slice()
            .sort((a, b) => sortCanon(a.v2, b.v2))
            .map((row) => (
              <OrderRow
                key={row.legacy.id}
                row={row}
                nowMs={nowMs}
                busy={busy}
                onAction={(a) => runAction(row, a)}
              />
            ))}
        </div>
      </details>

      <div className="mt-4 text-xs text-white/40">
        <Link className="underline" to={ROUTES.pizzaioloOrdersV2}>
          Voir /pro/commandes-v2
        </Link>
      </div>
    </div>
  );
}
