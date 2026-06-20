import { defineConfig } from 'vite';

// Static single-page build. Output goes to dist/ — point Cloudflare Pages'
// "Build output directory" here, with build command `npm run build`.
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // keep the résumé/images as real files, not data-URLs
  },
});
