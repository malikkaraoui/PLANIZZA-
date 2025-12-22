import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Trash2, Minus, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { ROUTES } from '../app/routes';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function Cart() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, truckId: cartTruckId, updateItemQty, removeItem, totalCents } = useCart();

  const truckId = location.state?.truckId ?? cartTruckId ?? null;

  const handleCheckout = () => {
    const qs = truckId ? `?truckId=${encodeURIComponent(truckId)}` : '';
    navigate(`${ROUTES.checkout}${qs}`, { state: { truckId } });
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl mb-2">Votre panier est vide</CardTitle>
            <CardDescription className="mb-6">
              Ajoutez des pizzas depuis un camion pour commencer
            </CardDescription>
            <Link to={ROUTES.explore}>
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Explorer les camions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link to={ROUTES.explore} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Continuer mes achats
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Panier</h1>
        <p className="text-muted-foreground mt-2">
          {items.length} article{items.length > 1 ? 's' : ''} dans votre panier
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Liste des articles */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Image (si disponible) */}
                  {item.photo && (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                      <img
                        src={item.photo}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Détails */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Bouton supprimer */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Supprimer</span>
                      </Button>
                    </div>

                    {/* Prix et quantité */}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        {formatEUR(item.priceCents * item.qty)}
                      </span>

                      {/* Contrôles quantité */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateItemQty(item.id, Math.max(0, item.qty - 1))}
                        >
                          <Minus className="h-3 w-3" />
                          <span className="sr-only">Diminuer la quantité</span>
                        </Button>

                        <span className="w-8 text-center font-medium">{item.qty}</span>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateItemQty(item.id, item.qty + 1)}
                        >
                          <Plus className="h-3 w-3" />
                          <span className="sr-only">Augmenter la quantité</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Récapitulatif */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Récapitulatif</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatEUR(totalCents)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatEUR(totalCents)}</span>
                </div>
              </div>
            </CardContent>

            <CardFooter>
              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleCheckout}
              >
                Commander
              </Button>
            </CardFooter>

            {!truckId && (
              <CardFooter className="pt-0">
                <p className="text-xs text-muted-foreground text-center w-full">
                  💡 Astuce : passez par la fiche camion pour un meilleur suivi
                </p>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
