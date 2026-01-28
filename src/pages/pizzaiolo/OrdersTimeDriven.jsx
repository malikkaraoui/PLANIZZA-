import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ROUTES } from '../../app/routes';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePizzaioloTruckId } from '../../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { useTruckOrders } from '../../features/orders/hooks/useTruckOrders';
import { useServerNow } from '../../hooks/useServerNow';
import { useAutoDismissMessage } from '../../hooks/useAutoDismissMessage';

import { legacyToOrderV2 } from '../../features/orders/v2/adapters/legacyToV2';
import { pizzaioloMarkOrderPaid, pizzaioloTransitionOrderV2 } from '../../lib/ordersApi';
import { devLog } from '../../lib/devLog';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import BackButton from '../../components/ui/BackButton';

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

function toIsoFromMs(ms) {
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function projectPickupTimeIso(pickupTime, createdAtIso) {
  if (typeof pickupTime !== 'string' || !/^\d{2}:\d{2}$/.test(pickupTime)) return null;
  if (typeof createdAtIso !== 'string') return null;
  const base = new Date(createdAtIso);
  if (!Number.isFinite(base.getTime())) return null;
  const [hh, mm] = pickupTime.split(':').map(Number);
  const projected = new Date(base);
  projected.setHours(hh, mm, 0, 0);
  if (!Number.isFinite(projected.getTime())) return null;
  return projected.toISOString();
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

    const legacyCreatedAtIso =
      toIsoFromMs(typeof order?.createdAt === 'number' ? order.createdAt : NaN) ||
      toIsoFromMs(typeof order?.createdAtClient === 'number' ? order.createdAtClient : NaN);

    const pickupProjected = projectPickupTimeIso(
      order?.pickupTime,
      createdAt || legacyCreatedAtIso || new Date().toISOString(),
    );

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

    const resolvedPromisedAt = pickupProjected || promisedAt;
    const resolvedPromisedAtMs = pickupProjected
      ? safeParseMs(pickupProjected)
      : promisedAtMs;

    return {
      ...embedded,
      id: order.id,
      promisedAt: resolvedPromisedAt,
      promisedAtMs: Number.isFinite(resolvedPromisedAtMs) ? resolvedPromisedAtMs : undefined,
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

function getLocalDate(ms) {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateLabel(dateStr, nowMs) {
  const now = new Date(nowMs);
  const todayStr = getLocalDate(nowMs);
  
  if (dateStr === todayStr) return "Aujourd'hui";
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterday.getTime());
  if (dateStr === yesterdayStr) return 'Hier';
  
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = getLocalDate(weekAgo.getTime());
  
  if (dateStr >= weekAgoStr) return 'Cette semaine';
  
  return 'Plus ancien';
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
    <section className="rounded-2xl md:rounded-3xl border border-white/10 bg-black/20 p-2 md:p-3">
      <div className="flex items-center justify-between gap-2 md:gap-3 px-1 md:px-2 py-1">
        <div className="text-xs md:text-sm font-semibold text-white/90">{title}</div>
        <Badge className="bg-white/10 text-white/80 text-[10px] md:text-xs">{rows.length}</Badge>
      </div>
      <div className="mt-2">
        {rows.length === 0 ? (
          <div className="px-2 py-3 text-[10px] md:text-xs text-white/50">{emptyText}</div>
        ) : (
          <div className="flex flex-col gap-1 md:gap-1">
            {rows.map((row) => row.render())}
          </div>
        )}
      </div>
    </section>
  );
}

function OrderRow({ row, nowMs, busy, onAction, isHistory = false, onClick }) {
  const { legacy, v2 } = row;

  const promisedMs = typeof v2.promisedAtMs === 'number' ? v2.promisedAtMs : safeParseMs(v2.promisedAt);
  const promisedHm = formatHmFromMs(promisedMs);
  const timer = isHistory ? '' : getTimerLabel(v2.promisedAt, nowMs);

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
    <div 
      className={`rounded-2xl border border-white/10 bg-white/5 p-3 ${
        isHistory ? 'cursor-pointer transition-colors hover:bg-white/10' : ''
      }`}
      onClick={isHistory && onClick ? () => onClick(row) : undefined}
    >
      {/* Layout Mobile */}
      <div className="block md:hidden space-y-3">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">{customer}</div>
            <div className="text-xs text-white/60 mt-0.5">{promisedHm} {!isHistory && `• ${timer}`}</div>
          </div>
          <div>
            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${payClass}`}>
              {paymentText}
            </span>
          </div>
        </div>
        
        {/* Infos */}
        <div className="flex items-center gap-3 text-xs">
          <div className="rounded-lg bg-white/10 px-2 py-1 text-white/80">
            {kitchenStatusLabel(v2.kitchenStatus)}
          </div>
          <div className="text-white/60">
            {fulfillmentLabel(v2.fulfillment)}
          </div>
          <div className="text-white/60">
            {itemsCount} article{itemsCount > 1 ? 's' : ''}
          </div>
        </div>
        
        {/* Actions */}
        {actionList.length > 0 && !isHistory && (
          <div className="flex flex-wrap gap-2">
            {actionList.map((a) => (
              <Button
                key={a.key}
                size="sm"
                variant={a.key === 'cancel' ? 'ghost' : 'secondary'}
                className={`flex-1 min-w-25 h-9 rounded-xl text-xs ${
                  a.key === 'cancel' ? 'text-white/70 hover:text-white' : ''
                }`}
                disabled={busy || Boolean(a.disabled)}
                title={a.title}
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(a);
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Layout Desktop */}
      <div className="hidden md:grid md:grid-cols-[64px_88px_86px_76px_92px_1fr_86px_auto] items-center gap-2 text-[12px]">
        <div className="font-mono text-white/90">{promisedHm}</div>
        <div className="font-mono text-white/80">{isHistory ? '—' : timer}</div>
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
              onClick={(e) => {
                e.stopPropagation();
                onAction(a);
              }}
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { truckId, loading: loadingTruckId, error: truckIdError } = usePizzaioloTruckId(user?.uid);
  const { orders, loading: ordersLoading, error: ordersError } = useTruckOrders(truckId, { navigate });
  const { nowMs } = useServerNow({ tickMs: 1000 });

  const [q, setQ] = useState('');
  const [mutating, setMutating] = useState(false);
  const [message, setMessage] = useState('');
  const [detailOrder, setDetailOrder] = useState(null);
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

  const historyByDate = useMemo(() => {
    const groups = {};
    
    for (const row of history) {
      // Utiliser updatedAtMs (quand terminée) ou createdAtMs comme fallback
      const ts = row.v2.updatedAtMs || row.v2.createdAtMs || safeParseMs(row.v2.createdAt);
      const dateStr = getLocalDate(ts);
      if (!dateStr) continue;
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(row);
    }
    
    // Trier les commandes au sein de chaque groupe (plus récentes en premier)
    for (const dateStr in groups) {
      groups[dateStr].sort((a, b) => {
        const aTs = a.v2.updatedAtMs || a.v2.createdAtMs || safeParseMs(a.v2.createdAt);
        const bTs = b.v2.updatedAtMs || b.v2.createdAtMs || safeParseMs(b.v2.createdAt);
        return bTs - aTs; // Plus récentes en premier
      });
    }
    
    // Organiser par catégories
    const today = [];
    const yesterday = [];
    const thisWeek = [];
    const older = [];
    
    const sortedDates = Object.keys(groups).sort().reverse(); // Dates les plus récentes en premier
    
    for (const dateStr of sortedDates) {
      const label = getDateLabel(dateStr, nowMs);
      const items = groups[dateStr];
      
      if (label === "Aujourd'hui") {
        today.push(...items);
      } else if (label === 'Hier') {
        yesterday.push(...items);
      } else if (label === 'Cette semaine') {
        thisWeek.push(...items);
      } else {
        older.push(...items);
      }
    }
    
    return { today, yesterday, thisWeek, older };
  }, [history, nowMs]);

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
        
        // 🔍 LOG: payload V2 action-based
        devLog('[FRONT V2 TRANSITION]', {
          orderId: row.legacy.id,
          action: action.key.toUpperCase(),
          expectedUpdatedAtMs,
        });

        await pizzaioloTransitionOrderV2({
          orderId: row.legacy.id,
          action: action.key.toUpperCase(), // ✅ VERBE uniquement (ACCEPT, START, READY, HANDOFF, DONE, CANCEL)
          expectedUpdatedAtMs,
        });

        // Message ultra simple (v0)
        if (action.key === 'accept') setMessage('✅ Commande acceptée.');
        else if (action.key === 'start') setMessage('✅ Préparation démarrée.');
        else if (action.key === 'ready') setMessage('✅ Commande prête.');
        else if (action.key === 'handoff') setMessage('✅ Commande remise.');
        else if (action.key === 'done') setMessage('✅ Commande terminée.');
        else if (action.key === 'cancel') setMessage('✅ Commande annulée.');
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
        const detailMsg = apiReason ? `${apiReason}` : 'transition_refused';
        const currentStatus = err?.details?.currentKitchenStatus;
        const extra = currentStatus ? ` (actuel: ${currentStatus})` : '';
        setMessage(`❌ Action refusée : ${detailMsg}${extra}`);
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
    <div className="mx-auto w-full max-w-6xl px-3 md:px-4 py-4 md:py-6">
      <BackButton className="mb-3 md:mb-4" />
      
      <div className="mb-3 md:mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base md:text-lg font-bold text-white">File d'attente (Temps)</div>
          <div className="mt-1 text-[10px] md:text-xs text-white/60">
            maintenant: {formatHmFromMs(nowMs)} <span className="hidden md:inline text-white/40">(tri global : promesse ↑)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto md:min-w-56">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="h-9 rounded-xl text-sm"
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
          title={`🔴 EN RETARD`}
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

      <details className="mt-4 md:mt-6 rounded-2xl md:rounded-3xl border border-white/10 bg-black/20 p-2 md:p-3">
        <summary className="cursor-pointer select-none px-2 py-1.5 md:py-1 text-xs md:text-sm font-semibold text-white/90">
          Historique (DONE / CANCELED / EXPIRED) <span className="text-white/60">[{history.length}]</span>
        </summary>
        <div className="mt-2 md:mt-3 space-y-2 md:space-y-3">
          {historyByDate.today.length > 0 && (
            <details open className="rounded-xl md:rounded-2xl border border-emerald-500/20 bg-emerald-950/20">
              <summary className="cursor-pointer select-none px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                📅 Aujourd'hui ({historyByDate.today.length})
              </summary>
              <div className="flex flex-col gap-1 px-1 md:px-2 pb-2 pt-1">
                {historyByDate.today.map((row) => (
                  <OrderRow
                    key={row.legacy.id}
                    row={row}
                    nowMs={nowMs}
                    busy={busy}
                    onAction={(a) => runAction(row, a)}
                    isHistory
                    onClick={setDetailOrder}
                  />
                ))}
              </div>
            </details>
          )}
          
          {historyByDate.yesterday.length > 0 && (
            <details className="rounded-xl md:rounded-2xl border border-blue-500/20 bg-blue-950/20">
              <summary className="cursor-pointer select-none px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-semibold text-blue-400 hover:text-blue-300">
                📅 Hier ({historyByDate.yesterday.length})
              </summary>
              <div className="flex flex-col gap-1 px-1 md:px-2 pb-2 pt-1">
                {historyByDate.yesterday.map((row) => (
                  <OrderRow
                    key={row.legacy.id}
                    row={row}
                    nowMs={nowMs}
                    busy={busy}
                    onAction={(a) => runAction(row, a)}
                    isHistory
                    onClick={setDetailOrder}
                  />
                ))}
              </div>
            </details>
          )}
          
          {historyByDate.thisWeek.length > 0 && (
            <details className="rounded-xl md:rounded-2xl border border-purple-500/20 bg-purple-950/20">
              <summary className="cursor-pointer select-none px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-semibold text-purple-400 hover:text-purple-300">
                📅 Cette semaine ({historyByDate.thisWeek.length})
              </summary>
              <div className="flex flex-col gap-1 px-1 md:px-2 pb-2 pt-1">
                {historyByDate.thisWeek.map((row) => (
                  <OrderRow
                    key={row.legacy.id}
                    row={row}
                    nowMs={nowMs}
                    busy={busy}
                    onAction={(a) => runAction(row, a)}
                    isHistory
                    onClick={setDetailOrder}
                  />
                ))}
              </div>
            </details>
          )}
          
          {historyByDate.older.length > 0 && (
            <details className="rounded-xl md:rounded-2xl border border-white/10 bg-white/5">
              <summary className="cursor-pointer select-none px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-semibold text-white/50 hover:text-white/70">
                📅 Plus ancien ({historyByDate.older.length})
              </summary>
              <div className="flex flex-col gap-1 px-1 md:px-2 pb-2 pt-1">
                {historyByDate.older.map((row) => (
                  <OrderRow
                    key={row.legacy.id}
                    row={row}
                    nowMs={nowMs}
                    busy={busy}
                    onAction={(a) => runAction(row, a)}
                    isHistory
                    onClick={setDetailOrder}
                  />
                ))}
              </div>
            </details>
          )}
          
          {history.length === 0 && (
            <div className="px-2 py-3 text-[10px] md:text-xs text-white/50">Aucune commande dans l'historique.</div>
          )}
        </div>
      </details>

      <div className="mt-4 text-xs text-white/40">
        <Link className="underline" to={ROUTES.pizzaioloOrdersV2}>
          Voir /pro/commandes-v2
        </Link>
      </div>

      {detailOrder && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 md:p-4"
          onClick={() => setDetailOrder(null)}
        >
          <div 
            className="relative w-full max-w-2xl max-h-[85vh] md:max-h-[80vh] overflow-y-auto rounded-2xl md:rounded-3xl border border-white/20 bg-linear-to-br from-gray-900 to-black p-4 md:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 md:top-4 md:right-4 flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white text-lg"
              onClick={() => setDetailOrder(null)}
            >
              ✕
            </button>

            <div className="space-y-3 md:space-y-4">
              <div>
                <div className="text-[10px] md:text-xs text-white/50">Commande</div>
                <div className="text-lg md:text-xl font-bold text-white">#{detailOrder.legacy.id}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <div className="text-[10px] md:text-xs text-white/50">Client</div>
                  <div className="text-sm md:text-base text-white">{detailOrder.legacy.customerName || detailOrder.v2.customer?.name || 'Client'}</div>
                </div>
                <div>
                  <div className="text-[10px] md:text-xs text-white/50">Statut</div>
                  <div className="text-sm md:text-base text-white">{kitchenStatusLabel(detailOrder.v2.kitchenStatus)}</div>
                </div>
                <div>
                  <div className="text-[10px] md:text-xs text-white/50">Paiement</div>
                  <div className="text-sm md:text-base text-white">{paymentStatusLabel(detailOrder.v2.paymentStatus)}</div>
                </div>
                <div>
                  <div className="text-[10px] md:text-xs text-white/50">Type</div>
                  <div className="text-sm md:text-base text-white">{fulfillmentLabel(detailOrder.v2.fulfillment)}</div>
                </div>
              </div>

              {detailOrder.legacy.deliveryAddress && (
                <div>
                  <div className="text-[10px] md:text-xs text-white/50">Adresse de livraison</div>
                  <div className="text-sm md:text-base text-white">{detailOrder.legacy.deliveryAddress}</div>
                </div>
              )}

              <div>
                <div className="mb-2 text-[10px] md:text-xs text-white/50">Articles</div>
                <div className="space-y-2">
                  {(detailOrder.legacy.items || detailOrder.v2.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="text-xs md:text-sm text-white truncate">{item.name}</div>
                        {item.description && (
                          <div className="text-[10px] md:text-xs text-white/50 truncate">{item.description}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs md:text-sm text-white">×{item.qty || 1}</div>
                        <div className="text-[10px] md:text-xs text-white/50">{((item.priceCents || 0) / 100).toFixed(2)}€</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 md:pt-4">
                <div className="flex justify-between text-base md:text-lg font-bold">
                  <div className="text-white/70">Total</div>
                  <div className="text-white">
                    {((detailOrder.legacy.items || detailOrder.v2.items || []).reduce(
                      (sum, it) => sum + (it.priceCents || 0) * (it.qty || 1),
                      0
                    ) / 100).toFixed(2)}€
                  </div>
                </div>
              </div>

              {detailOrder.v2.timestamps && Object.keys(detailOrder.v2.timestamps).length > 0 && (
                <div>
                  <div className="mb-2 text-[10px] md:text-xs text-white/50">Chronologie</div>
                  <div className="space-y-1 text-[10px] md:text-xs">
                    {detailOrder.v2.timestamps.acceptedAt && (
                      <div className="text-white/70">Acceptée: {new Date(detailOrder.v2.timestamps.acceptedAt).toLocaleString('fr-FR')}</div>
                    )}
                    {detailOrder.v2.timestamps.startedAt && (
                      <div className="text-white/70">Démarrée: {new Date(detailOrder.v2.timestamps.startedAt).toLocaleString('fr-FR')}</div>
                    )}
                    {detailOrder.v2.timestamps.readyAt && (
                      <div className="text-white/70">Prête: {new Date(detailOrder.v2.timestamps.readyAt).toLocaleString('fr-FR')}</div>
                    )}
                    {detailOrder.v2.timestamps.handedOffAt && (
                      <div className="text-white/70">Remise: {new Date(detailOrder.v2.timestamps.handedOffAt).toLocaleString('fr-FR')}</div>
                    )}
                    {detailOrder.v2.timestamps.completedAt && (
                      <div className="text-white/70">Terminée: {new Date(detailOrder.v2.timestamps.completedAt).toLocaleString('fr-FR')}</div>
                    )}
                    {detailOrder.v2.timestamps.canceledAt && (
                      <div className="text-white/70">Annulée: {new Date(detailOrder.v2.timestamps.canceledAt).toLocaleString('fr-FR')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
