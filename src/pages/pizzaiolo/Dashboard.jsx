import { Link, Outlet } from 'react-router-dom';

export default function PizzaioloDashboard() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-64">
          <div className="rounded-xl border bg-white p-4">
            <div className="font-bold text-gray-900">Espace pizzaiolo</div>
            <nav className="mt-3 flex flex-col gap-2 text-sm">
              <Link className="hover:underline" to="/pizzaiolo/profile">
                Profil camion
              </Link>
              <Link className="hover:underline" to="/pizzaiolo/menu">
                Menu
              </Link>
              <Link className="hover:underline" to="/pizzaiolo/orders">
                Commandes
              </Link>
            </nav>
          </div>
        </aside>
        <section className="flex-1">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
