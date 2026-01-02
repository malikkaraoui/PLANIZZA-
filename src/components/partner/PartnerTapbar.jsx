import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../app/routes';

function Tab({ to, children, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `w-full px-3 py-2 text-sm font-semibold rounded-xl transition text-center ${
          isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function PartnerTapbar() {
  return (
    <div className="border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex justify-center">
          <div className="bg-gray-900 text-white px-6 py-2 text-sm font-semibold rounded-xl">
            Tarifs
          </div>
        </div>
      </div>
    </div>
  );
}
