import Card from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { ITEM_TYPES } from '../../constants';

function typeEmoji(type) {
  const raw = ITEM_TYPES.find((t) => t.value === type)?.label;
  if (!raw) return '🍽️';
  return raw.split(' ')[0] || '🍽️';
}

export function PizzaioloMenuItemList({ items, onDelete, formatPrice }) {
  return (
    <div className="grid gap-4">
      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">Aucun article dans votre menu. Commencez par en ajouter un !</p>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{typeEmoji(item.type)}</span>
                  <h3 className="font-bold text-gray-900">{item.name}</h3>
                  {item.type === 'pizza' && (
                    <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">Pizza</span>
                  )}
                </div>

                {item.description && <p className="mt-1 text-sm text-gray-600">{item.description}</p>}

                <div className="mt-3 flex items-center gap-4 flex-wrap">
                  {(item.type === 'pizza' || ['soda', 'eau', 'biere'].includes(item.type)) && item.sizes ? (
                    item.type === 'pizza' ? (
                      <>
                        {item.sizes.s && (
                          <span className="text-sm font-semibold text-gray-900">
                            S ({item.sizes.s.diameter}cm): {formatPrice(item.sizes.s.priceCents)}
                          </span>
                        )}
                        {item.sizes.m && (
                          <span className="text-sm font-semibold text-gray-900">
                            M ({item.sizes.m.diameter}cm): {formatPrice(item.sizes.m.priceCents)}
                          </span>
                        )}
                        {item.sizes.l && (
                          <span className="text-sm font-semibold text-gray-900">
                            L ({item.sizes.l.diameter}cm): {formatPrice(item.sizes.l.priceCents)}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {item.sizes['25cl'] && (
                          <span className="text-sm font-semibold text-gray-900">
                            25cL: {formatPrice(item.sizes['25cl'].priceCents)}
                          </span>
                        )}
                        {item.sizes['33cl'] && (
                          <span className="text-sm font-semibold text-gray-900">
                            33cL: {formatPrice(item.sizes['33cl'].priceCents)}
                          </span>
                        )}
                        {item.sizes['50cl'] && (
                          <span className="text-sm font-semibold text-gray-900">
                            50cL: {formatPrice(item.sizes['50cl'].priceCents)}
                          </span>
                        )}
                        {item.sizes['1l'] && (
                          <span className="text-sm font-semibold text-gray-900">
                            1L: {formatPrice(item.sizes['1l'].priceCents)}
                          </span>
                        )}
                      </>
                    )
                  ) : item.type === 'pizza' && item.prices ? (
                    // Retro-compatibilité ancien format
                    <>
                      <span className="text-sm font-semibold text-gray-900">Classic: {formatPrice(item.prices.classic)}</span>
                      <span className="text-sm font-semibold text-gray-900">Large: {formatPrice(item.prices.large)}</span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-gray-900">{formatPrice(item.priceCents)}</span>
                  )}
                </div>
              </div>

              <Button onClick={() => onDelete(item.id)} className="bg-red-600 hover:bg-red-700">
                Supprimer
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
