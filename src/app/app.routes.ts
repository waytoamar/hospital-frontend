import { Routes } from '@angular/router';
import { roleGuard } from './guards/role-guard';

// Each page is downloaded only when someone opens it, so the receptionist's / pharmacist's
// phone does not download the doctor's screens (and the Excel library) it never uses.
export const routes: Routes = [
  // ---- Public website (no login) ----
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about').then((m) => m.About),
  },
  {
    // Meta needs this link for WhatsApp Business
    path: 'privacy',
    loadComponent: () => import('./pages/privacy/privacy').then((m) => m.Privacy),
  },

  // ---- Sign in ----
  {
    path: 'welcome',
    loadComponent: () => import('./pages/welcome/welcome').then((m) => m.Welcome),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'pin/:role',
    loadComponent: () => import('./pages/pin-login/pin-login').then((m) => m.PinLogin),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
  },

  // ---- Staff screens ----
  {
    path: 'dashboard',
    canActivate: [roleGuard('doctor')],
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'staff',
    canActivate: [roleGuard('doctor')],
    loadComponent: () => import('./pages/staff-manager/staff-manager').then((m) => m.StaffManager),
  },
  {
    path: 'reception',
    canActivate: [roleGuard('receptionist')],
    loadComponent: () => import('./pages/reception/reception').then((m) => m.Reception),
  },
  {
    path: 'pharmacy',
    canActivate: [roleGuard('pharmacist')],
    loadComponent: () => import('./pages/pharmacy/pharmacy').then((m) => m.Pharmacy),
  },
  {
    path: 'lab',
    canActivate: [roleGuard('lab')],
    loadComponent: () => import('./pages/lab/lab').then((m) => m.Lab),
  },

  { path: '**', redirectTo: 'welcome' },
];
