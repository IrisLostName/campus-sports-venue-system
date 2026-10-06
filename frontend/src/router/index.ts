import { createRouter, createWebHistory } from 'vue-router';

import PlaceholderView from '../views/PlaceholderView.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{ path: '/', name: 'placeholder', component: PlaceholderView }],
});
