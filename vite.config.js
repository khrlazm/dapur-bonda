import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS is enabled because WebXR (entering VR on Quest) requires a secure
// context. On desktop http://localhost also counts as secure, but to test on
// a Quest headset over your LAN you need https — hence basic-ssl.
//
//   npm run dev         -> https://localhost:5173      (desktop)
//   npm run dev:quest   -> https://<your-lan-ip>:5173  (open this on the Quest browser)
//
// The Quest browser will warn about the self-signed cert the first time —
// tap "Advanced -> Proceed" once and it remembers.
// Set DAPUR_HTTP=1 to serve plain HTTP (handy for quick local desktop testing
// in embedded browsers that reject self-signed certs). Leave it unset for the
// normal HTTPS dev server you need when testing WebXR on a Quest.
const useHttp = process.env.DAPUR_HTTP === '1';

export default defineConfig({
  plugins: useHttp ? [] : [basicSsl()],
  server: {
    https: !useHttp,
    port: useHttp ? 8080 : 5173,
    host: true,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  optimizeDeps: {
    // three/webgpu ships a large ESM entry; let Vite prebundle it.
    include: ['three', 'three/webgpu', 'three/tsl'],
  },
});
