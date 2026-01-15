import { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

const Home = lazy(() => import('../pages/Home'));
const Trucks = lazy(() => import('../pages/Trucks'));
const TruckDetails = lazy(() => import('../pages/TruckDetails'));
const Cart = lazy(() => import('../pages/Cart'));
const Checkout = lazy(() => import('../pages/Checkout'));
const CheckoutSuccess = lazy(() => import('../pages/CheckoutSuccess'));
const OrderTracking = lazy(() => import('../pages/OrderTracking'));
const Account = lazy(() => import('../pages/Account'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Orders = lazy(() => import('../pages/Orders'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));

const PizzaioloDashboard = lazy(() => import('../pages/pizzaiolo/Dashboard'));
const PizzaioloProfile = lazy(() => import('../pages/pizzaiolo/Profile'));
const PizzaioloMenu = lazy(() => import('../pages/pizzaiolo/Menu'));
const PizzaioloOrders = lazy(() => import('../pages/pizzaiolo/OrdersTimeDriven'));
const PizzaioloOrdersV2 = lazy(() => import('../pages/pizzaiolo/OrdersV2'));
const PizzaioloStats = lazy(() => import('../pages/pizzaiolo/Stats'));
const PizzaioloLive = lazy(() => import('../pages/pizzaiolo/Live'));
const PizzaioloStart = lazy(() => import('../pages/pizzaiolo/Start'));
const CreateTruck = lazy(() => import('../pages/pizzaiolo/CreateTruck'));
const E2ETransitionContract = lazy(() => import('../pages/E2ETransitionContract'));

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

      // Legacy redirects (compat)
      { path: 'trucks', element: <Navigate to="/explore" replace /> },
      { path: 'trucks/:truckId', element: wrap(<TruckDetails />) },
      { path: 'truck/:truckId', element: wrap(<TruckDetails />) },
      { path: 't/:truckId', element: wrap(<TruckDetails />) },
      { path: 'pricing', element: <Navigate to="/explore" replace /> },
      { path: 'success', element: <Navigate to="/checkout/success" replace /> },
      { path: 'cancel', element: <Navigate to="/explore" replace /> },

      // Auth
      { path: 'login', element: wrap(<Login />) },
      { path: 'register', element: wrap(<Register />) },


      // Client (privé plus tard; navigation en place)
      { path: 'dashboard', element: <ProtectedRoute>{wrap(<Dashboard />)}</ProtectedRoute> },
      { path: 'mon-compte', element: <ProtectedRoute>{wrap(<Account />)}</ProtectedRoute> },
      { path: 'commandes', element: <ProtectedRoute>{wrap(<Orders />)}</ProtectedRoute> },

      // Pizzaiolo start (public pour découverte)
      { path: 'pizzaiolo/start', element: wrap(<PizzaioloStart />) },

      // Création de camion (privé pizzaiolo)
      { 
        path: 'pro/creer-camion', 
        element: (
          <ProtectedRoute requirePizzaiolo={true}>
            {wrap(<CreateTruck />)}
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
          { path: 'live', element: wrap(<PizzaioloLive />) },
        ],
      },

      ...e2eRoutes,

      // Route dynamique truck en DERNIER (catch-all pour les slugs)
      { path: ':truckId', element: wrap(<TruckDetails />) },
    ],
  },
]);
