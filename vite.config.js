import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Optimize for CI environments
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          wallet: ['@dynamic-labs/sdk-react-core', '@dynamic-labs/ethereum'],
          web3: ['viem', 'wagmi', '@rainbow-me/rainbowkit']
        }
      }
    }
  }
})
