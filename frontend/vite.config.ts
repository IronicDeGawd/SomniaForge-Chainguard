import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::", // Listen on all IPv6 addresses (includes IPv4)
    port: 8080,
    strictPort: false,
    // Allow requests from production domain
    cors: true,
    hmr: {
      clientPort: mode === 'development' ? 8080 : 443,
    },
  },
  preview: {
    host: "localhost", // Preview only on localhost for PM2
    port: 3001,
    strictPort: true,
    cors: true,
    // Allow Caddy reverse proxy from production domain
    proxy: {
      '/': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          wagmi: ['wagmi', 'viem', '@rainbow-me/rainbowkit'],
        },
      },
    },
  },
}));
