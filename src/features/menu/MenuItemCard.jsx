import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function MenuItemCard({ item, onAdd }) {
  return (
    <Card className="p-4 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold text-gray-900">{item.name}</div>
        <div className="text-sm text-gray-600">{formatEUR(item.priceCents)}</div>
      </div>
      <Button
        variant="secondary"
        onClick={() => onAdd(item)}
        disabled={!item.available}
        title={!item.available ? 'Indisponible' : 'Ajouter'}
      >
        Ajouter
      </Button>
    </Card>
  );
}
