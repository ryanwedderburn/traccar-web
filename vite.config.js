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
      // Upstream leaves this at the default 'prompt', where a new worker
      // installs and then WAITS until the user taps the refresh snackbar in
      // UpdateController or closes every tab on the origin. Nobody does either:
      // a deploy reached a normal browser only after a hard reload, which is
      // why "works in a private window" was the signature of three separate
      // problems in one day - private windows have no worker and always get the
      // current build.
      //
      // With autoUpdate the new worker skips waiting and claims clients, so a
      // deploy lands on the next load.
      //
      // The cost, accepted deliberately: a client can reload itself while
      // someone is using it. UpdateController polls at
      // `serviceWorkerUpdateInterval` (default one hour), so a spectator
      // watching the race could see the page refresh mid-event. A brief reload
      // beats a spectator on a stale build for the whole weekend, which is the
      // alternative - and during an event the deploy freeze makes it moot.
      //
      // UpdateController is left alone. Its snackbar is now inert because
      // needRefresh never becomes true, but its periodic update() check is what
      // makes a long-lived tab notice a deploy at all, and keeping the file
      // untouched keeps the rebase surface at zero.
      registerType: 'autoUpdate',
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
        // `/live` IS LISTED BY NAME, against the rule above, because it has no
        // shape to match. It is a single fixed servlet path
        // (org.traccar.web.LiveLoginServlet, mounted in WebModule) rather than
        // a family of files, and an anchored exact match cannot shadow a React
        // route the way a broad prefix could.
        //
        // FOUND 2026-08-29, and it predates the login-page button that exposed
        // it. THE PRINTED SIGNAGE POINTS AT /live. Any spectator whose phone had
        // ever loaded this origin already had the worker installed, so scanning
        // the sign served them the app shell and a blank screen - the server
        // never asked, nothing in the console. It worked in a private window,
        // which is the signature this file's own comment describes and which
        // had already cost a day once.
        //
        // See docs/ONBOARD-STATION.md, docs/ONBOARD-REMOTE.md and
        // docs/ONBOARD-SPECTATOR.md.
        navigateFallbackDenylist: [/^\/api/, /^\/[\w-]+\.html$/, /^\/live$/],
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
