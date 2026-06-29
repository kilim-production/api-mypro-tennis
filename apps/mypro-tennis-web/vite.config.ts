import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["offline.html", "icon.svg", "icon-192.png", "icon-512.png"],
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
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "/index.html"
      }
    })
  ],
  server: {
    port: 5173
  }
});
