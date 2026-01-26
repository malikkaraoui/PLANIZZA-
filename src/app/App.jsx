import { RouterProvider } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { router } from './router';
import { AuthProvider } from './providers/AuthProvider';
import { CartProvider } from '../features/cart/hooks/useCart.jsx';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          limit={5}
        />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
