import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

import { homeGallery } from './build/galleryPlugin.ts';

export default defineConfig({
  plugins: [vue(), homeGallery()],
});
