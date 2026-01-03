import { createBrowserRouter, Navigate } from 'react-router-dom';
import Home from '../pages/Home';
import Trucks from '../pages/Trucks';
import TruckDetails from '../pages/TruckDetails';
import Cart from '../pages/Cart';
import Checkout from '../pages/Checkout';
import CheckoutSuccess from '../pages/CheckoutSuccess';
import OrderTracking from '../pages/OrderTracking';
import Account from '../pages/Account';
import Dashboard from '../pages/Dashboard';
import Orders from '../pages/Orders';
import Login from '../pages/Login';
import Register from '../pages/Register';

import PizzaioloDashboard from '../pages/pizzaiolo/Dashboard';
import PizzaioloProfile from '../pages/pizzaiolo/Profile';
import PizzaioloMenu from '../pages/pizzaiolo/Menu';
import PizzaioloOrders from '../pages/pizzaiolo/Orders';
import PizzaioloLive from '../pages/pizzaiolo/Live';
import PizzaioloStart from '../pages/pizzaiolo/Start';
import CreateTruck from '../pages/pizzaiolo/CreateTruck';

import RootLayout from '../components/layout/RootLayout';
import ProtectedRoute from './ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // Root
      { index: true, element: <Navigate to="/explore" replace /> },
      { path: 'home', element: <Home /> },

      // Public (navigation canon)
      { path: 'explore', element: <Trucks /> },
      { path: 'panier', element: <Cart /> },
      { path: 'checkout', element: <Checkout /> },
      { path: 'checkout/success', element: <CheckoutSuccess /> },
      { path: 'order/:orderId', element: <OrderTracking /> },

      // Partenaires / Pro
      { path: 'devenez_partenaire', element: <PizzaioloStart /> },

      // Legacy redirects (compat)
      { path: 'trucks', element: <Navigate to="/explore" replace /> },
      { path: 'trucks/:truckId', element: <TruckDetails /> },
      { path: 'truck/:truckId', element: <TruckDetails /> },
      { path: 't/:truckId', element: <TruckDetails /> },
      { path: 'pricing', element: <Navigate to="/explore" replace /> },
      { path: 'success', element: <Navigate to="/checkout/success" replace /> },
      { path: 'cancel', element: <Navigate to="/explore" replace /> },

      // Auth
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },


      // Client (privé plus tard; navigation en place)
      { path: 'dashboard', element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
      { path: 'mon-compte', element: <ProtectedRoute><Account /></ProtectedRoute> },
      { path: 'commandes', element: <ProtectedRoute><Orders /></ProtectedRoute> },

      // Pizzaiolo start (public pour découverte)
      { path: 'pizzaiolo/start', element: <PizzaioloStart /> },

      // Création de camion (privé pizzaiolo)
      { 
        path: 'pro/creer-camion', 
        element: (
          <ProtectedRoute requirePizzaiolo={true}>
            <CreateTruck />
          </ProtectedRoute>
        )
      },

      // Pizzaiolo (dashboard) - RÉSERVÉ AUX PIZZAIOLOS
      {
        path: 'pro',
        element: (
          <ProtectedRoute requirePizzaiolo={true}>
            <PizzaioloDashboard />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="truck" replace /> },
          { path: 'truck', element: <PizzaioloProfile /> },
          { path: 'menu', element: <PizzaioloMenu /> },
          { path: 'commandes', element: <PizzaioloOrders /> },
          { path: 'live', element: <PizzaioloLive /> },
        ],
      },

      // Route dynamique truck en DERNIER (catch-all pour les slugs)
      { path: ':truckId', element: <TruckDetails /> },
    ],
  },
]);
