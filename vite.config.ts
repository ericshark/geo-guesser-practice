import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({plugins:[react(),tailwindcss(),VitePWA({registerType:'prompt',workbox:{globPatterns:['**/*.{js,css,html,svg,woff2,json}']},manifest:{name:'GeoGuessr Academy',short_name:'Academy',theme_color:'#101916',background_color:'#101916',display:'standalone',icons:[{src:'/compass.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}})]});
