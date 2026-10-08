import { createWebHistory } from 'vue-router';

import { useAuthStore } from '../stores/auth';
import { createAppRouter } from './factory';

export const router = createAppRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  views: {
    login: () => import('../views/LoginView.vue'),
    clientShell: () => import('../views/user/ClientShell.vue'),
    home: () => import('../views/user/HomeView.vue'),
    reservation: () => import('../views/user/ReservationView.vue'),
    booking: () => import('../views/user/BookingView.vue'),
    me: () => import('../views/user/MeView.vue'),
    venueAdmin: () => import('../views/venue-admin/VenueAdminShell.vue'),
    venueAdminOverview: () => import('../views/venue-admin/OverviewView.vue'),
    venueAdminReservations: () => import('../views/venue-admin/ReservationsView.vue'),
    venueAdminResources: () => import('../views/venue-admin/ResourcesView.vue'),
    venueAdminOccupancy: () => import('../views/venue-admin/OccupancyView.vue'),
    venueAdminAnnouncements: () => import('../views/venue-admin/AnnouncementsView.vue'),
    venueAdminRepairs: () => import('../views/venue-admin/RepairsView.vue'),
    venueAdminLogs: () => import('../views/venue-admin/LogsView.vue'),
    sysAdmin: () => import('../views/sys-admin/SysAdminHome.vue'),
    display: () => import('../views/display/DisplayView.vue'),
  },
  getAuth: () => useAuthStore(),
});
