# Architecture - Page Commandes Pizzaiolo

## Vue d'ensemble

La page des commandes a été refactorisée pour être modulaire, maintenable et évolutive. Elle organise les commandes en 3 sections distinctes avec tri chronologique automatique.

## Structure des fichiers

```
src/
├── pages/pizzaiolo/
│   └── Orders.jsx                          # Page principale
├── features/orders/
│   ├── components/
│   │   ├── OrderCard.jsx                   # Composant carte de commande réutilisable
│   │   └── OrderSection.jsx                # Composant section avec en-tête
│   └── utils/
│       └── deliveryTimeCalculator.js       # Logique de calcul temps de livraison
```

## Composants

### OrderCard.jsx
**Responsabilité** : Afficher une commande individuelle avec toutes ses informations

**Props** :
- `order` : Données de la commande
- `statusConfig` : Configuration du statut
- `elapsed` : Temps écoulé
- `remaining` : Temps restant estimé
- `estimatedDeliveryTime` : Heure de livraison prévue (HH:MM)
- `onAccept` : Callback prendre en charge
- `onDeliver` : Callback délivrer
- `onMarkPaid` : Callback marquer payé
- `onClick` : Callback clic sur carte
- `updating` : État de mise à jour
- `borderVariant` : 'default' | 'paid' | 'unpaid'

**Logs** : 
- Render avec orderId, status, paymentStatus
- Clics sur boutons d'action

### OrderSection.jsx
**Responsabilité** : Afficher une section de commandes avec en-tête visuel

**Props** :
- `title` : Titre de la section
- `count` : Nombre de commandes
- `color` : Couleur du thème (ex: 'orange-500')
- `children` : Contenu (liste de OrderCard)

**Comportement** : 
- Auto-masquage si count === 0
- Logs de render

### deliveryTimeCalculator.js
**Responsabilité** : Logique de calcul et tri des heures de livraison

**Fonctions** :

1. `getEstimatedDeliveryTime(order, pizzaPerHour)`
   - Retourne : timestamp (ms)
   - Logique :
     * Si pickupTime manuel → conversion en timestamp
     * Sinon → calcul basé sur cadence + temps préparation
   - Logs détaillés de chaque étape

2. `formatDeliveryTime(timestamp)`
   - Retourne : string (HH:MM)
   - Protection contre timestamps invalides

3. `sortOrdersByDeliveryTime(orders, pizzaPerHour)`
   - Retourne : array trié
   - Tri chronologique croissant
   - Logs du résultat

4. `groupOrdersByStatus(orders)`
   - Retourne : {notAccepted, acceptedPaid, acceptedUnpaid}
   - Vérification d'intégrité (pas de perte)
   - Logs des compteurs

## Organisation des sections

### Section 1 : Non prises en charge (Orange)
- **Statut** : `status === 'received'`
- **Tri** : Par heure de livraison prévue
- **Actions** : Prendre en charge + PAYÉ (si manuel non payé)
- **Timer** : Chrono (secondes écoulées)

### Section 2 : En préparation · Payées (Vert)
- **Statut** : `status === 'accepted' && paymentStatus === 'paid'`
- **Tri** : Par heure de livraison prévue
- **Border** : Bordure gauche verte (4px)
- **Actions** : Délivré
- **Timer** : Temps restant estimé

### Section 3 : En préparation · Non payées (Orange)
- **Statut** : `status === 'accepted' && paymentStatus !== 'paid'`
- **Tri** : Par heure de livraison prévue
- **Border** : Bordure gauche orange (4px)
- **Actions** : PAYÉ
- **Timer** : Temps restant estimé

## File conducteur

### Principe
Toutes les commandes sont triées par ordre chronologique de livraison **prévue**, pas par ordre de création.

### Calcul de l'heure prévue

**Cas 1 : Commande manuelle avec pickupTime**
```javascript
pickupTime = "14:30"
→ timestamp = aujourd'hui à 14h30
```

**Cas 2 : Calcul automatique**
```javascript
totalPizzas = 3
pizzaPerHour = 30
minutesPerPizza = 60 / 30 = 2 min/pizza
tempsPréparation = 3 * 2 = 6 minutes
heurePrevu = acceptedAt (ou createdAt) + 6 minutes
```

### Affichage
Badge orange avec :
- Icône Clock
- Heure formatée (HH:MM)
- Label contextuel : "Retrait prévu" (manuel) ou "Prêt estimé" (calculé)

## Sécurités et validations

### 1. Vérification d'intégrité
```javascript
// Dans groupOrdersByStatus()
const totalGrouped = notAccepted + acceptedPaid + acceptedUnpaid;
if (totalGrouped !== orders.length) {
  console.error('PERTE DE COMMANDES!', {diff});
}
```

### 2. Protection valeurs invalides
- Timestamps : vérification `typeof === 'number'`
- Arrays : vérification `Array.isArray()`
- Fallbacks sur Date.now() ou []

### 3. Logs de debug
Tous les composants et fonctions loggent :
- État au render
- Paramètres reçus
- Résultats calculés
- Erreurs éventuelles

Prefixe : `[NomComposant]` ou `[nomFonction]`

## Évolutions futures

### 1. Ajout de sections
Créer une nouvelle section :
```jsx
<OrderSection 
  title="Nouvelle section" 
  count={newOrders.length}
  color="blue-500"
>
  {newOrders.map(order => (
    <OrderCard key={order.id} {...props} />
  ))}
</OrderSection>
```

### 2. Nouveaux calculs de temps
Étendre `deliveryTimeCalculator.js` :
```javascript
export function getEstimatedDeliveryTimeWithUber(order, uberApiTime) {
  const baseTime = getEstimatedDeliveryTime(order);
  return baseTime + uberApiTime;
}
```

### 3. Personnalisation OrderCard
Ajouter des variants ou props :
```jsx
<OrderCard 
  variant="compact"
  showDetails={false}
  customBadges={[...]}
/>
```

## Tests recommandés

### Tests unitaires
1. `deliveryTimeCalculator.js`
   - Calcul avec pickupTime
   - Calcul automatique
   - Tri correct
   - Groupement sans perte

2. Composants
   - OrderCard : render avec différentes props
   - OrderSection : auto-masquage si count=0

### Tests d'intégration
1. Commande manuelle → création → affichage section 1
2. Prise en charge → déplacement vers section 2 ou 3
3. Paiement → déplacement vers section 2
4. Tri correct après ajout commande

### Tests visuels
1. Bordures colorées selon section
2. Heures de livraison affichées
3. Transitions fluides
4. Responsive (colonnes)

## Debug

### Logs clés à surveiller
```
[PizzaioloOrders] Groupes de commandes
[getEstimatedDeliveryTime] Manuel avec pickupTime
[sortOrdersByDeliveryTime] Résultat tri
[groupOrdersByStatus] Groupes
[OrderCard] Render
[OrderSection] Render
```

### En cas de problème

**Commandes manquantes** :
→ Chercher "PERTE DE COMMANDES" dans les logs

**Mauvais tri** :
→ Vérifier logs `[sortOrdersByDeliveryTime]`

**Heure incorrecte** :
→ Vérifier logs `[getEstimatedDeliveryTime]`

**Section vide** :
→ Vérifier logs `[groupOrdersByStatus]`

## Performance

### Optimisations actuelles
- Composants purs (pas de re-render inutiles)
- Tri effectué 1 fois par groupe
- Logs conditionnels (console.log, pas console.trace)

### À surveiller
- Nombre de OrderCard rendus (max ~50 recommandé)
- Fréquence de mise à jour (actuellement 1s)
- Taille des logs en production (désactiver si nécessaire)

## Conventions de code

### Naming
- Composants : PascalCase
- Fonctions utilitaires : camelCase
- Constantes : UPPER_SNAKE_CASE
- Props : camelCase

### Structure JSX
```jsx
<Component
  prop1={value}
  prop2={value}
>
  {children}
</Component>
```

### Logs
```javascript
console.log('[ComponentName] Message', {data});
console.warn('[functionName] Warning', value);
console.error('[ComponentName] ERROR', error);
```

---

**Dernière mise à jour** : 6 janvier 2026
**Version** : 1.0.0
**Auteur** : Système de refactoring Orders
