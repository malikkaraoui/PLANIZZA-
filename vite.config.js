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

          // Gros vendors ciblés
          if (id.includes('/firebase/')) return 'vendor-firebase';
          if (id.includes('/@stripe/') || id.includes('/stripe/')) return 'vendor-stripe';
          if (id.includes('/chart.js/') || id.includes('/react-chartjs-2/') || id.includes('/recharts/')) {
            return 'vendor-charts';
          }

          // UI / composants / icônes / dnd
          if (id.includes('/@radix-ui/')) return 'vendor-radix';
          if (id.includes('/lucide-react/')) return 'vendor-icons';
          if (id.includes('/@atlaskit/pragmatic-drag-and-drop')) return 'vendor-dnd';
          if (id.includes('/react-qr-code/')) return 'vendor-qr';

          // Utils
          if (id.includes('/lodash')) return 'vendor-lodash';

          // Le reste des deps
          return 'vendor';
        },
      },
    },
  },
})
