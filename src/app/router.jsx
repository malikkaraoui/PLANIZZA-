import { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

const LAZY_RETRY_KEY = 'planizza:lazy-retry';

const lazyWithRetry = (factory) => lazy(() => {
  return factory().catch((error) => {
    const message = String(error?.message || '');
    const isChunkError =
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Importing a module script failed') ||
      message.includes('ChunkLoadError') ||
      message.includes('Loading chunk');

    if (isChunkError && typeof window !== 'undefined') {
      const now = Date.now();
      const last = Number(sessionStorage.getItem(LAZY_RETRY_KEY) || 0);
      const shouldReload = !Number.isFinite(last) || now - last > 60_000;

      if (shouldReload) {
        try {
          sessionStorage.setItem(LAZY_RETRY_KEY, String(now));
        } catch {
          // ignore
        }
        window.location.reload();
        return new Promise(() => {});
      }
    }

    throw error;
  });
});

const Home = lazyWithRetry(() => import('../pages/Home'));
const Trucks = lazyWithRetry(() => import('../pages/Trucks'));
const TruckDetails = lazyWithRetry(() => import('../pages/TruckDetails'));
const Cart = lazyWithRetry(() => import('../pages/Cart'));
const Checkout = lazyWithRetry(() => import('../pages/Checkout'));
const CheckoutSuccess = lazyWithRetry(() => import('../pages/CheckoutSuccess'));
const OrderTracking = lazyWithRetry(() => import('../pages/OrderTracking'));
const Account = lazyWithRetry(() => import('../pages/Account'));
const Dashboard = lazyWithRetry(() => import('../pages/Dashboard'));
const Orders = lazyWithRetry(() => import('../pages/Orders'));
const Auth = lazyWithRetry(() => import('../pages/Auth'));
const AuthAction = lazyWithRetry(() => import('../pages/AuthAction'));
// RegisterPizzaiolo supprimé - fusionné dans CreateTruck

const PizzaioloDashboard = lazyWithRetry(() => import('../pages/pizzaiolo/Dashboard'));
const PizzaioloProfile = lazyWithRetry(() => import('../pages/pizzaiolo/Profile'));
const PizzaioloMenu = lazyWithRetry(() => import('../pages/pizzaiolo/Menu'));
const PizzaioloOrders = lazyWithRetry(() => import('../pages/pizzaiolo/OrdersTimeDriven'));
const PizzaioloOrdersV2 = lazyWithRetry(() => import('../pages/pizzaiolo/OrdersV2'));
const PizzaioloStats = lazyWithRetry(() => import('../pages/pizzaiolo/Stats'));
const PizzaioloLive = lazyWithRetry(() => import('../pages/pizzaiolo/Live'));
const PizzaioloReviews = lazyWithRetry(() => import('../pages/pizzaiolo/Reviews'));
const PizzaioloStart = lazyWithRetry(() => import('../pages/pizzaiolo/Start'));
const CreateTruck = lazyWithRetry(() => import('../pages/pizzaiolo/CreateTruck'));
const StripeOnboarding = lazyWithRetry(() => import('../pages/pizzaiolo/StripeOnboarding'));
const E2ETransitionContract = lazyWithRetry(() => import('../pages/E2ETransitionContract'));
const NotFound = lazyWithRetry(() => import('../pages/NotFound'));
const Contact = lazyWithRetry(() => import('../pages/Contact'));

import RootLayout from '../components/layout/RootLayout';
import ProtectedRoute from './ProtectedRoute';

function wrap(element) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-white/70">
            Chargement…
          </div>
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

const e2eRoutes = import.meta.env.VITE_E2E === 'true'
  ? [{ path: '__e2e__/transition', element: wrap(<E2ETransitionContract />) }]
  : [];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // Root
      { index: true, element: <Navigate to="/explore" replace /> },
      { path: 'home', element: wrap(<Home />) },

      // Public (navigation canon)
      { path: 'explore', element: wrap(<Trucks />) },
      { path: 'panier', element: wrap(<Cart />) },
      { path: 'checkout', element: wrap(<Checkout />) },
      { path: 'checkout/success', element: wrap(<CheckoutSuccess />) },
      { path: 'order/:orderId', element: wrap(<OrderTracking />) },

      // Partenaires / Pro
      { path: 'devenez_partenaire', element: wrap(<PizzaioloStart />) },
      { path: 'contact', element: wrap(<Contact />) },

      // Legacy redirects (compat)
      { path: 'trucks', element: <Navigate to="/explore" replace /> },
      { path: 'trucks/:truckId', element: wrap(<TruckDetails />) },
      { path: 'truck/:truckId', element: wrap(<TruckDetails />) },
      { path: 't/:truckId', element: wrap(<TruckDetails />) },
      { path: 'pricing', element: <Navigate to="/explore" replace /> },
      { path: 'success', element: <Navigate to="/checkout/success" replace /> },
      { path: 'cancel', element: <Navigate to="/explore" replace /> },

      // Auth (page unifiée avec onglets)
      { path: 'login', element: wrap(<Auth />) },
      { path: 'register', element: <Navigate to="/register/client" replace /> },
      { path: 'register/client', element: wrap(<Auth />) },
      { path: 'auth/action', element: wrap(<AuthAction />) },
      // pro/inscription redirige vers le formulaire unifié de création camion
      { path: 'pro/inscription', element: <Navigate to="/pro/creer-camion" replace /> },


      // Client (privé requireClient)
      { path: 'dashboard', element: <ProtectedRoute requireClient={true}>{wrap(<Dashboard />)}</ProtectedRoute> },
      { path: 'mon-compte', element: <ProtectedRoute requireClient={true}>{wrap(<Account />)}</ProtectedRoute> },
      { path: 'commandes', element: <ProtectedRoute requireClient={true}>{wrap(<Orders />)}</ProtectedRoute> },

      // Pizzaiolo start (public pour découverte)
      { path: 'pizzaiolo/start', element: wrap(<PizzaioloStart />) },

      // Création de camion (PUBLIC - gère sa propre auth dans le formulaire)
      // L'étape 0 crée le compte, les étapes suivantes créent le camion
      { path: 'pro/creer-camion', element: wrap(<CreateTruck />) },

      // Stripe Connect onboarding return page
      {
        path: 'pro/onboarding',
        element: (
          <ProtectedRoute requirePizzaiolo={true}>
            {wrap(<StripeOnboarding />)}
          </ProtectedRoute>
        )
      },

      // Pizzaiolo (dashboard) - RÉSERVÉ AUX PIZZAIOLOS
      {
        path: 'pro',
        element: (
          <ProtectedRoute requirePizzaiolo={true}>
            {wrap(<PizzaioloDashboard />)}
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="truck" replace /> },
          { path: 'truck', element: wrap(<PizzaioloProfile />) },
          { path: 'menu', element: wrap(<PizzaioloMenu />) },
          { path: 'commandes', element: wrap(<PizzaioloOrders />) },
          { path: 'commandes-v2', element: wrap(<PizzaioloOrdersV2 />) },
          { path: 'stats', element: wrap(<PizzaioloStats />) },
          { path: 'live', element: <Navigate to="/pro/commandes" replace /> },
          { path: 'avis', element: wrap(<PizzaioloReviews />) },
        ],
      },

      ...e2eRoutes,

      // Route dynamique truck (pour les slugs de camions)
      { path: ':truckId', element: wrap(<TruckDetails />) },

      // 404 - Page non trouvée (catch-all final)
      { path: '*', element: wrap(<NotFound />) },
    ],
  },
]);
