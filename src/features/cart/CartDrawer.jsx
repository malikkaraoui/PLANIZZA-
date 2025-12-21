import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useCart } from './hooks/useCart.jsx';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function CartDrawer({ onCheckout }) {
  const { items, removeItem, totalCents } = useCart();

  return (
    <Card className="p-4 space-y-3">
      <div className="font-bold text-gray-900">Panier</div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-600">Votre panier est vide.</div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-semibold text-gray-900">
                  {it.name} <span className="text-gray-500">× {it.qty}</span>
                </div>
                <div className="text-gray-600">{formatEUR(it.priceCents * it.qty)}</div>
              </div>
              <button
                className="text-xs text-red-600 hover:underline"
                onClick={() => removeItem(it.id)}
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-3">
        <div className="text-sm text-gray-600">Total</div>
        <div className="font-bold">{formatEUR(totalCents)}</div>
      </div>

      <Button className="w-full" onClick={onCheckout} disabled={items.length === 0}>
        Payer
      </Button>
    </Card>
  );
}
