import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const apiProxy = {
  '^/api(?:$|/(?!mobile-update\\.(?:html|js)(?:$|\\?)))': { target: 'http://localhost:4000', changeOrigin: true },
};

export default defineConfig({
  server: { port: 3000, host: '127.0.0.1', proxy: apiProxy },
  preview: { proxy: apiProxy },
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'maskable-icon-512x512.png'],
    manifest: {
      name: '旅程準備與行李清單', short_name: '旅程準備',
      description: '在本機記錄旅程準備及待確認事項',
      theme_color: '#205b53', background_color: '#f5f5ef', display: 'standalone',
      scope: '/', start_url: '/', lang: 'zh-TW',
      // Lets Android list the installed app in the share sheet; param names must match SHARE_PARAMS in domain/receiptText.ts.
      share_target: { action: '/', method: 'GET', params: { title: 'receipt_title', text: 'receipt_text', url: 'receipt_url' } },
      icons: [
        {src:'pwa-192x192.png',sizes:'192x192',type:'image/png'},
        {src:'pwa-512x512.png',sizes:'512x512',type:'image/png'},
        {src:'maskable-icon-512x512.png',sizes:'512x512',type:'image/png',purpose:'maskable'},
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
      globIgnores: ['api/mobile-update.*'],
      navigateFallbackDenylist: [/^\/api\//],
      runtimeCaching: [],
    },
  })],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
