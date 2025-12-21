import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './providers/AuthProvider';
import { CartProvider } from '../features/cart/hooks/useCart.jsx';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
