import { Routes } from '@angular/router';
import { roleGuard } from './guards/role-guard';

// Each page is downloaded only when someone opens it, so the receptionist's / pharmacist's
// phone does not download the doctor's screens (and the Excel library) it never uses.
export const routes: Routes = [
  // Public website: Home and About Us. Staff sign in from /welcome.
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./components/site/home/home').then((m) => m.Home),
  },
  {
    path: 'about',
    loadComponent: () => import('./components/site/about/about').then((m) => m.About),
  },
  {
    path: 'welcome',
    loadComponent: () => import('./components/welcome/welcome').then((m) => m.Welcome),
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'pin/:role',
    loadComponent: () => import('./components/pin-login/pin-login').then((m) => m.PinLogin),
  },
  {
    path: 'dashboard',
    canActivate: [roleGuard('doctor')],
    loadComponent: () => import('./components/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'reception',
    canActivate: [roleGuard('receptionist')],
    loadComponent: () => import('./components/reception/reception').then((m) => m.Reception),
  },
  {
    path: 'pharmacy',
    canActivate: [roleGuard('pharmacist')],
    loadComponent: () => import('./components/pharmacy/pharmacy').then((m) => m.Pharmacy),
  },
  {
    path: 'lab',
    canActivate: [roleGuard('lab')],
    loadComponent: () => import('./pages/lab/lab').then((m) => m.Lab),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'staff',
    canActivate: [roleGuard('doctor')],
    loadComponent: () =>
      import('./components/staff-manager/staff-manager').then((m) => m.StaffManager),
  },
  {
    // Public (no login). Meta needs this link for WhatsApp Business.
    path: 'privacy',
    loadComponent: () => import('./components/privacy/privacy').then((m) => m.Privacy),
  },
  { path: '**', redirectTo: 'welcome' },
];
