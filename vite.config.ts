import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(), // Merges CSS into the JS file
    dts({ insertTypesEntry: true }),
  ],
  define: {
    'process.env.NODE_ENV': '"production"', // Prevents crash in non-React apps
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/chaos-sdk.ts'),
      name: 'ChaosSdk',
      fileName: (format) => `chaos-sdk.${format}.js`,
    },
    rollupOptions: {
      // Intentionally NOT externalizing React.
      // We bundle it so this works in Vue/Svelte/Vanilla too.
      external: [],
    },
  },
});
