import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'rewrite-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            // /app、/config、/reports 等路由都指向 app/index.html
            if (req.url && (req.url === '/app' || req.url.startsWith('/config') || req.url.startsWith('/reports'))) {
              req.url = '/app/index.html';
            }
            // /help 指向 help/index.html
            if (req.url === '/help') {
              req.url = '/help/index.html';
            }
            // /pricing 指向 pricing/index.html
            if (req.url === '/pricing') {
              req.url = '/pricing/index.html';
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          app: path.resolve(__dirname, 'app/index.html'),
          pricing: path.resolve(__dirname, 'pricing/index.html'),
          help: path.resolve(__dirname, 'help/index.html'),
        },
      },
    },
  };
});
