import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // ─── Dev server ───────────────────────────────────────────────────────────
  server: {
    host: true,
    port: 5173,
  },

  // ─── Production build ─────────────────────────────────────────────────────
  build: {
    // Target modern browsers — enables native ESM, async/await, optional
    // chaining, etc. without unnecessary polyfills.
    target: 'esnext',

    // esbuild is significantly faster than terser and produces near-identical
    // output for React apps.  Terser is needed only when you require specific
    // Terser transforms (e.g. IIFE wrapping) — we don't.
    minify: 'esbuild',

    // Disable source maps in production — reduces deploy artifact size and
    // prevents leaking readable source to end-users.
    sourcemap: false,

    // Raise the warning threshold slightly — recharts + radix-ui push the
    // vendor chunk above the 500 kB default.  Chunks are still well-split.
    chunkSizeWarningLimit: 1800,

    rollupOptions: {
      output: {
        /**
         * Manual chunk strategy — keeps each "concern" in its own cacheable
         * file so that a new deploy only invalidates the chunks that changed:
         *
         *   react-vendor  — React, ReactDOM, react-router  (rarely changes)
         *   supabase      — Supabase JS client             (rarely changes)
         *   charts        — recharts + d3 internals        (only on chart work)
         *   radix         — all @radix-ui/* packages       (only on UI work)
         *   app           — (implicit) your own code       (changes every deploy)
         *
         * Apache can set long-lived Cache-Control headers on the vendor chunks
         * since they are content-hashed (e.g. react-vendor.abc123.js).
         */
        manualChunks(id: string) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase';
          }
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-') ||
            id.includes('node_modules/internmap')
          ) {
            return 'charts';
          }
          if (id.includes('node_modules/@radix-ui/')) {
            return 'radix';
          }
          if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/')) {
            return 'motion';
          }
        },

        // Consistent filename patterns for Apache caching rules:
        //   assets/js/[name].[hash].js
        //   assets/css/[name].[hash].css
        entryFileNames: 'assets/js/[name].[hash].js',
        chunkFileNames: 'assets/js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name?.split('.').pop() ?? '';
          if (['css'].includes(ext))    return 'assets/css/[name].[hash].[ext]';
          if (['png','jpg','jpeg','gif','webp','svg','ico'].includes(ext))
                                        return 'assets/img/[name].[hash].[ext]';
          if (['woff','woff2','ttf','eot'].includes(ext))
                                        return 'assets/fonts/[name].[hash].[ext]';
          return 'assets/[name].[hash].[ext]';
        },
      },
    },

    // Let esbuild drop console.log in production.
    // Keep console.warn and console.error so runtime errors are still visible
    // in the browser console / Apache error logs.
    esbuildOptions: {
      drop: ['debugger'],
      // To also strip console.log, uncomment the next line:
      // pure: ['console.log'],
    },
  },

  // ─── Preview server (npm run preview) ─────────────────────────────────────
  preview: {
    host: true,
    port: 4173,
  },
})
