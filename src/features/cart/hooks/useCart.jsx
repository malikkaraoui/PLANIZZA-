/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  const addItem = (item) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) => (p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeItem = (itemId) => {
    setItems((prev) => prev.filter((p) => p.id !== itemId));
  };

  const clear = () => setItems([]);

  const totalCents = useMemo(
    () => items.reduce((sum, it) => sum + it.priceCents * it.qty, 0),
    [items]
  );

  const value = useMemo(
    () => ({ items, addItem, removeItem, clear, totalCents }),
    [items, totalCents]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider />');
  return ctx;
}
