import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(() => ({
  server: {
    port: 3000,
    proxy: {
      '/api/socket': 'ws://localhost:8082',
      '/api': 'http://localhost:8082',
    },
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 1100,
  },
  plugins: [
    svgr(),
    react(),
    VitePWA({
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      workbox: {
        // The service worker answers every *navigation* with the precached
        // index.html, so any path that is not a React route must be listed
        // here or it silently becomes the app shell. Browsing to such a path
        // gives a blank page - React boots, the router matches nothing, and
        // nothing in the console says the service worker substituted the
        // document. The server is never even asked.
        //
        // Pages served from Traccar's web.override directory are not part of
        // this build at all, so they need the same exemption /api has.
        //
        // Matched by SHAPE rather than by name - any top-level *.html - because
        // listing them individually failed the first time it was tested: adding
        // setup.html alongside onboard.html would have shipped a page that
        // renders blank for anyone with the app cached, with nothing in the
        // console and the server never asked. No React route ends in .html, so
        // this cannot shadow one.
        //
        // See docs/ONBOARD-STATION.md and docs/ONBOARD-REMOTE.md.
        navigateFallbackDenylist: [/^\/api/, /^\/[\w-]+\.html$/],
        globPatterns: ['**/*.{js,css,html,woff,woff2,mp3}'],
      },
      manifest: {
        short_name: '${title}',
        name: '${description}',
        theme_color: '${colorPrimary}',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js', dest: '' },
      ],
    }),
  ],
}));
