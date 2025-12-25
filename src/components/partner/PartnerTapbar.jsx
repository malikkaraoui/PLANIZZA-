import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../app/routes';

function Tab({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `w-full px-3 py-2 text-sm font-semibold rounded-xl transition text-center ${
          isActive ? 'bg-gray-900 text-white' : 'text-gray-900 hover:bg-gray-100'
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
        <div className="grid grid-cols-2 gap-2">
          <Tab to={ROUTES.becomePartner}>Devenir partenaire</Tab>
          <Tab to={ROUTES.becomePartnerPricing}>Tarifs</Tab>
        </div>
      </div>
    </div>
  );
}
