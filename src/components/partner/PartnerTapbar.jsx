import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../app/routes';

function Tab({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 text-sm font-semibold rounded-md transition ${
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
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
        <Tab to={ROUTES.becomePartner}>Devenir partenaire</Tab>
        <Tab to={ROUTES.becomePartnerPricing}>Tarifs</Tab>
      </div>
    </div>
  );
}
