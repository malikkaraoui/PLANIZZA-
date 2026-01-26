import { RouterProvider } from 'react-router-dom';
import { ToastContainer, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/toast.css';
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
          pauseOnFocusLoss={false}
          draggable
          draggableDirection="x"
          draggablePercent={35}
          pauseOnHover={false}
          theme="dark"
          limit={5}
          transition={Slide}
        />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
