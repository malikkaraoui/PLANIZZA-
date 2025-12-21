import Card from '../../components/ui/Card';

export default function PizzaioloMenu() {
  return (
    <Card className="p-6">
      <h1 className="text-xl font-bold text-gray-900">Menu</h1>
      <p className="mt-2 text-gray-600">
        MVP : CRUD simple pizzas/boissons (nom, prix, photo, dispo).
      </p>
      {/* TODO: liste + formulaire + upload image (plus tard) */}
    </Card>
  );
}
