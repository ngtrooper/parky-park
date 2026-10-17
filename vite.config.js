import { defineConfig } from 'vite';
// VITE_PLATFORM=web|crazygames|poki|gamedistribution picks the platform adapter (src/platform/).
export default defineConfig({ base: './', build: { target: 'es2022', chunkSizeWarningLimit: 2000 } });
