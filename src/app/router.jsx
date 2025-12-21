import { createBrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';
import Pricing from '../pages/Pricing';
import Success from '../pages/Success';
import Cancel from '../pages/Cancel';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/pricing',
    element: <Pricing />,
  },
  {
    path: '/success',
    element: <Success />,
  },
  {
    path: '/cancel',
    element: <Cancel />,
  },
  // TODO: Ajouter d'autres routes ici (Dashboard, Auth, etc.)
]);
