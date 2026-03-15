import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@watergun/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  define: {
    '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: true, // Allow network access for mobile testing
    port: 3000,
  },
});
