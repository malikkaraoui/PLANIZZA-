import { Outlet, ScrollRestoration } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import PausedTruckWatcher from '../../features/cart/PausedTruckWatcher';
import ErrorBoundary from '../ErrorBoundary';
import RouteDebug from '../../app/RouteDebug';
import { useOrderStatusNotifications } from '../../features/orders/hooks/useOrderStatusNotifications';

// Composant qui active les notifications globales de commandes
function OrderNotificationsListener() {
  useOrderStatusNotifications();
  return null;
}

export default function RootLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gray-50 pt-24">
        <ErrorBoundary title="Impossible d'afficher la page">
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
      <PausedTruckWatcher />
      <OrderNotificationsListener />
      <RouteDebug />
      <ScrollRestoration getKey={(location) => `${location.pathname}${location.search}`} />
    </div>
  );
}
