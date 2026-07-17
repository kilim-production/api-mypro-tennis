import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "offline.html",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
        "visuals/mypro-loading-keyart.webp"
      ],
      manifest: {
        name: "MYPRO - TENNIS",
        short_name: "MYPRO Tennis",
        description: "Jeu de gestion de carrière tennis massivement multijoueur.",
        lang: "fr",
        theme_color: "#07111f",
        background_color: "#07111f",
        display: "standalone",
        orientation: "landscape",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,webp,ico}"],
        globIgnores: [
          "**/visuals/players/*",
          "**/visuals/mypro-loading-keyart.png",
          "**/visuals/lobby-stadium.png",
          "**/visuals/app-arena.png",
          "**/visuals/chests/*.png",
          "**/brand/mypro-tennis-logo-aaa.png",
          "**/icon-1024.png"
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/visuals\/players\/pp-\d{2}-hero\.webp$/,
            handler: "CacheFirst",
            options: {
              cacheName: "mypro-player-heroes-v1",
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /\/(?:visuals\/club|profile-pictures)\/.*\.(?:jpg|jpeg|png|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "mypro-static-visuals-v1",
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          }
        ],
        navigateFallback: "/index.html"
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          icons: ["lucide-react"],
          "react-vendor": ["react", "react-dom", "react-router-dom", "zustand"]
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
