import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // './' makes asset paths work under https://<user>.github.io/<repo>/
  base: './',
})
