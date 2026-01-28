import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // React core - chargé en premier, mis en cache longtemps
          if (id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react-dom';
          if (id.includes('/react/') && !id.includes('react-')) return 'vendor-react';

          // React Router
          if (id.includes('/react-router')) return 'vendor-router';

          // Firebase - gros module, séparé
          if (id.includes('/firebase/')) return 'vendor-firebase';

          // Stripe
          if (id.includes('/@stripe/') || id.includes('/stripe/')) return 'vendor-stripe';

          // Charts (lourds, utilisés uniquement sur Stats)
          if (id.includes('/chart.js/') || id.includes('/react-chartjs-2/') || id.includes('/recharts/')) {
            return 'vendor-charts';
          }

          // Maps (Leaflet)
          if (id.includes('/leaflet/') || id.includes('/react-leaflet/')) return 'vendor-map';

          // UI / composants / icônes / dnd
          if (id.includes('/@radix-ui/')) return 'vendor-radix';
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (id.includes('/@atlaskit/pragmatic-drag-and-drop')) return 'vendor-dnd';
          if (id.includes('/react-qr-code/')) return 'vendor-qr';

          // Toast
          if (id.includes('/react-toastify/')) return 'vendor-toast';

          // Utils
          if (id.includes('/lodash')) return 'vendor-lodash';
          if (id.includes('/clsx/') || id.includes('/tailwind-merge/') || id.includes('/class-variance-authority/')) {
            return 'vendor-utils';
          }

          // Le reste des deps
          return 'vendor';
        },
      },
    },
  },
})
