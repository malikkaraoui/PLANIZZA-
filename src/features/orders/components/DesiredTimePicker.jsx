import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { getTodayOpeningHours } from '../../../lib/openingHours';
import {
  getMinDesiredTime,
  maxTime,
  validateDesiredTime,
} from '../utils/desiredTime';

const TIME_RE = /^\d{2}:\d{2}$/;

export default function DesiredTimePicker({
  label = 'Heure souhaitée',
  value,
  onChange,
  pizzaCount = 0,
  deliveryMethod = 'pickup',
  openingHours,
  baseLeadMinutes = 0,
  perPizzaMinutes = 5,
  deliveryExtraMinutes = 15,
  onErrorChange,
  helperText,
}) {
  const [touched, setTouched] = useState(false);

  const { minDate, minTime, totalMinutes } = useMemo(() => {
    return getMinDesiredTime({
      now: new Date(),
      pizzaCount,
      deliveryMethod,
      baseLeadMinutes,
      perPizzaMinutes,
      deliveryExtraMinutes,
    });
  }, [pizzaCount, deliveryMethod, baseLeadMinutes, perPizzaMinutes, deliveryExtraMinutes]);

  const todayOpening = useMemo(() => {
    return getTodayOpeningHours(openingHours, new Date());
  }, [openingHours]);

  const inputMin = useMemo(() => {
    if (todayOpening?.enabled && todayOpening.open) {
      return maxTime(minTime, todayOpening.open);
    }
    return minTime;
  }, [minTime, todayOpening]);

  const validationError = useMemo(() => {
    if (!touched) return '';
    if (!value || !TIME_RE.test(value)) return '';
    const { error: nextError } = validateDesiredTime({
      value,
      now: new Date(),
      minDate,
      openingHours,
      getTodayOpeningHours,
    });
    return nextError || '';
  }, [touched, value, minDate, openingHours]);

  useEffect(() => {
    if (typeof onErrorChange === 'function') {
      onErrorChange(validationError);
    }
  }, [validationError, onErrorChange]);

  const handleBlur = () => {
    setTouched(true);
  };

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-2">
        <Clock className="h-4 w-4" />
        {label}
      </label>
      <Input
        type="time"
        value={value}
        onChange={(event) => {
          const newTime = event.target.value;
          setTouched(false);
          if (typeof onChange === 'function') {
            onChange(newTime);
          }
        }}
        onBlur={handleBlur}
        min={inputMin}
        className="rounded-xl"
      />
      {helperText && (
        <p className="mt-2 text-xs text-muted-foreground">
          {helperText}
        </p>
      )}
      {totalMinutes > 0 && !validationError && (
        <p className="mt-2 text-xs text-muted-foreground">
          ⏱️ Minimum conseillé : {minTime}
        </p>
      )}
      {validationError && (
        <p className="mt-2 text-xs font-bold text-red-600">
          ⚠️ {validationError}
        </p>
      )}
      {todayOpening && todayOpening.enabled && todayOpening.open && todayOpening.close && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Horaires aujourd'hui : {todayOpening.open} – {todayOpening.close}
        </p>
      )}
      {todayOpening && !todayOpening.enabled && (
        <p className="mt-2 text-[11px] text-red-600">
          🚫 Camion fermé aujourd'hui
        </p>
      )}
    </div>
  );
}
