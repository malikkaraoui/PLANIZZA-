import { Outlet, ScrollRestoration } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import PausedTruckWatcher from '../../features/cart/PausedTruckWatcher';
import ErrorBoundary from '../ErrorBoundary';
import RouteDebug from '../../app/RouteDebug';

export default function RootLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gray-50">
        <ErrorBoundary title="Impossible d'afficher la page">
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
      <PausedTruckWatcher />
      <RouteDebug />
      <ScrollRestoration getKey={(location) => `${location.pathname}${location.search}`} />
    </div>
  );
}
