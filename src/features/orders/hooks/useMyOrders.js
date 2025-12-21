import { useEffect, useState } from 'react';

// MVP: placeholder (mock)
export function useMyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setOrders([]);
      setLoading(false);
    }, 150);

    return () => clearTimeout(t);
  }, []);

  return { orders, loading };
}
