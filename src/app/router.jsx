import { createBrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';
import Pricing from '../pages/Pricing';
import Success from '../pages/Success';
import Cancel from '../pages/Cancel';

import Trucks from '../pages/Trucks';
import TruckDetails from '../pages/TruckDetails';
import CheckoutSuccess from '../pages/CheckoutSuccess';
import Login from '../pages/Login';
import Register from '../pages/Register';

import PizzaioloDashboard from '../pages/pizzaiolo/Dashboard';
import PizzaioloProfile from '../pages/pizzaiolo/Profile';
import PizzaioloMenu from '../pages/pizzaiolo/Menu';
import PizzaioloOrders from '../pages/pizzaiolo/Orders';

import RootLayout from '../components/layout/RootLayout';
import ProtectedRoute from './ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'pricing', element: <Pricing /> },
      { path: 'success', element: <Success /> },
      { path: 'cancel', element: <Cancel /> },

      // Marketplace (MVP)
      { path: 'trucks', element: <Trucks /> },
      { path: 'trucks/:truckId', element: <TruckDetails /> },
      // Canonical short link (requested)
      { path: 't/:truckId', element: <TruckDetails /> },
      { path: 'checkout/success', element: <CheckoutSuccess /> },

      // Auth
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },

      // Pizzaiolo (dashboard)
      {
        path: 'pizzaiolo',
        element: (
          <ProtectedRoute>
            <PizzaioloDashboard />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <PizzaioloProfile /> },
          { path: 'dashboard', element: <PizzaioloProfile /> },
          { path: 'profile', element: <PizzaioloProfile /> },
          { path: 'menu', element: <PizzaioloMenu /> },
          { path: 'orders', element: <PizzaioloOrders /> },
        ],
      },
    ],
  },
]);
