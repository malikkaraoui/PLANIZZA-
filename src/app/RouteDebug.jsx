import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

function getNavEntryType() {
  try {
    const entry = performance?.getEntriesByType?.('navigation')?.[0];
    return entry?.type || null; // 'navigate' | 'reload' | 'back_forward' | ...
  } catch {
    return null;
  }
}

function formatLine({ ts, navType, path, search, navEntryType }) {
  const time = new Date(ts).toLocaleTimeString('fr-FR');
  const full = `${path}${search || ''}`;
  const parts = [`${time}`, navType, full];
  if (navEntryType) parts.push(`(${navEntryType})`);
  return parts.join(' · ');
}

export default function RouteDebug() {
  const location = useLocation();
  const navType = useNavigationType(); // POP | PUSH | REPLACE

  const [isOpen, setIsOpen] = useState(true);
  const [lines, setLines] = useState([]);

  const navEntryType = useMemo(() => getNavEntryType(), []);

  useEffect(() => {
    const ts = Date.now();
    setLines((prev) => {
      const next = [
        ...prev,
        {
          ts,
          navType,
          path: location.pathname,
          search: location.search,
          navEntryType: prev.length === 0 ? navEntryType : null,
        },
      ];
      return next.slice(-25);
    });
  }, [location.pathname, location.search, navType, navEntryType]);

  if (!import.meta.env.DEV) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-3 right-3 z-50 rounded-full border border-black/10 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-800 shadow-lg backdrop-blur"
      >
        Debug nav
      </button>
    );
  }

  const headerLabel = navEntryType === 'reload' ? 'RELOAD détecté' : 'SPA';

  return (
    <div className="fixed bottom-3 right-3 z-50 w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-black/10 bg-white/90 text-gray-900 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-black/10 px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs font-black tracking-wide">Navigation · {headerLabel}</div>
          <div className="truncate text-[11px] text-gray-600">{location.pathname}{location.search}</div>
        </div>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs font-bold text-gray-700 hover:bg-black/5"
          onClick={() => setIsOpen(false)}
          aria-label="Fermer le debug"
        >
          Fermer
        </button>
      </div>

      <div className="max-h-60 overflow-auto px-3 py-2">
        <ul className="space-y-1">
          {lines.map((l, idx) => (
            <li key={`${l.ts}-${idx}`} className="text-[11px] leading-snug text-gray-800">
              {formatLine(l)}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-black/10 px-3 py-2">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-black/5"
          onClick={() => setLines([])}
        >
          Effacer
        </button>
        <div className="text-[11px] text-gray-500">DEV only</div>
      </div>
    </div>
  );
}
