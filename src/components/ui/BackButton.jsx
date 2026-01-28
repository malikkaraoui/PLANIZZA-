import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * Bouton retour unifié pour tout le site
 * @param {Object} props
 * @param {string} props.label - Texte du bouton (défaut: "Retour")
 * @param {string} props.to - Destination fixe (sinon navigate(-1))
 * @param {string} props.className - Classes CSS additionnelles
 * @param {Function} props.onClick - Handler personnalisé (prioritaire sur `to`)
 */
export default function BackButton({ label = 'Retour', to, className = '', onClick }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl glass-premium border-white/40 text-[11px] font-black tracking-widest uppercase hover:bg-white/10 transition-all text-muted-foreground hover:text-primary group shadow-xl hover:shadow-2xl hover:scale-105 ${className}`}
    >
      <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
      {label}
    </button>
  );
}
