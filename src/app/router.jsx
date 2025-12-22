import { createBrowserRouter, Navigate } from 'react-router-dom';
import Home from '../pages/Home';
import Trucks from '../pages/Trucks';
import TruckDetails from '../pages/TruckDetails';
import Cart from '../pages/Cart';
import Checkout from '../pages/Checkout';
import CheckoutSuccess from '../pages/CheckoutSuccess';
import OrderTracking from '../pages/OrderTracking';
import Account from '../pages/Account';
import Orders from '../pages/Orders';
import Login from '../pages/Login';
import Register from '../pages/Register';
import DevenezPartenaire from '../pages/DevenezPartenaire';
import DevenezPartenaireInscription from '../pages/DevenezPartenaireInscription';
import DevenezPartenaireValidation from '../pages/DevenezPartenaireValidation';
import DevenezPartenaireTarifs from '../pages/DevenezPartenaireTarifs';

import PizzaioloDashboard from '../pages/pizzaiolo/Dashboard';
import PizzaioloProfile from '../pages/pizzaiolo/Profile';
import PizzaioloMenu from '../pages/pizzaiolo/Menu';
import PizzaioloOrders from '../pages/pizzaiolo/Orders';
import PizzaioloStart from '../pages/pizzaiolo/Start';

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
      { path: 'truck/:truckId', element: <TruckDetails /> },
      { path: 'cart', element: <Cart /> },
      { path: 'checkout', element: <Checkout /> },
      { path: 'checkout/success', element: <CheckoutSuccess /> },
      { path: 'order/:orderId', element: <OrderTracking /> },

      // Partenaires / Pro
      { path: 'devenez_partenaire', element: <DevenezPartenaire /> },
      { path: 'devenez_partenaire/inscription', element: <DevenezPartenaireInscription /> },
      { path: 'devenez_partenaire/validation', element: <DevenezPartenaireValidation /> },
      { path: 'devenez_partenaire/tarifs', element: <DevenezPartenaireTarifs /> },

      // Legacy redirects (compat)
      { path: 'trucks', element: <Navigate to="/explore" replace /> },
      { path: 'trucks/:truckId', element: <Navigate to="/truck/:truckId" replace /> },
      { path: 't/:truckId', element: <Navigate to="/truck/:truckId" replace /> },
      { path: 'pricing', element: <Navigate to="/explore" replace /> },
      { path: 'success', element: <Navigate to="/checkout/success" replace /> },
      { path: 'cancel', element: <Navigate to="/explore" replace /> },

      // Auth
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },

      // Client (privé plus tard; navigation en place)
      { path: 'mon-compte', element: <ProtectedRoute><Account /></ProtectedRoute> },
      { path: 'commandes', element: <ProtectedRoute><Orders /></ProtectedRoute> },

      // Pizzaiolo start (public pour découverte)
      { path: 'pizzaiolo/start', element: <PizzaioloStart /> },

      // Pizzaiolo (dashboard) - RÉSERVÉ AUX PIZZAIOLOS
      {
        path: 'pizzaiolo',
        element: (
          <ProtectedRoute requirePizzaiolo={true}>
            <PizzaioloDashboard />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <PizzaioloProfile /> },
          { path: 'profile', element: <PizzaioloProfile /> },
          { path: 'menu', element: <PizzaioloMenu /> },
          { path: 'orders', element: <PizzaioloOrders /> },
        ],
      },
    ],
  },
]);
