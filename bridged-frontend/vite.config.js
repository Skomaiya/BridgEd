import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2,woff,ttf,eot}"],
        ignoreURLParametersMatching: [/^theme$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr)\.net\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "bridged-external-assets",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "BridgEd",
        short_name: "BridgEd",
        description: "Competency-Based Industrial Placement & Recruitment",
        theme_color: "#0d9488",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [],
      },
    }),
  ],
});
