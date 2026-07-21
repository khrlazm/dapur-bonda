import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Set DAPUR_HTTP=1 to serve plain HTTP (handy for quick local desktop testing
// in embedded browsers that reject self-signed certs). Leave it unset for the
// normal HTTPS dev server you need when testing WebXR on a Quest.
export default defineConfig(({ command }) => {
  const useHttp = process.env.DAPUR_HTTP === '1';

  return {
    // GitHub Pages serves this project from https://<user>.github.io/dapur-bonda/,
    // so the production build needs that sub-path as its base for asset URLs to
    // resolve. Dev keeps '/'. Override with BASE_PATH if you fork under a
    // different repo name (e.g. BASE_PATH=/my-fork/ npm run build).
    base: command === 'build' ? (process.env.BASE_PATH || '/dapur-bonda/') : '/',

    plugins: useHttp ? [] : [basicSsl()],

    server: {
      // npm run dev       -> https://localhost:5173      (desktop)
      // npm run dev:quest -> https://<your-lan-ip>:5173  (open on the Quest browser)
      // DAPUR_HTTP=1      -> http://localhost:8080        (no VR; WebXR needs https)
      https: !useHttp,
      port: useHttp ? 8080 : 5173,
      host: true,
    },

    build: {
      target: 'esnext',
      sourcemap: false,
    },

    optimizeDeps: {
      include: ['three', 'three/webgpu', 'three/tsl'],
    },
  };
});
