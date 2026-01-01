import { Outlet, ScrollRestoration } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import PausedTruckWatcher from '../../features/cart/PausedTruckWatcher';

export default function RootLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gray-50">
        <Outlet />
      </main>
      <Footer />
      <PausedTruckWatcher />
      <ScrollRestoration getKey={(location) => `${location.pathname}${location.search}`} />
    </div>
  );
}
