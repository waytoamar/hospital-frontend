import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { Dashboard } from './components/dashboard/dashboard';
import { Welcome } from './components/welcome/welcome';
import { PinLogin } from './components/pin-login/pin-login';
import { Reception } from './components/reception/reception';
import { Pharmacy } from './components/pharmacy/pharmacy';
import { Lab } from './pages/lab/lab';
import { roleGuard } from './guards/role-guard';
import { ForgotPassword } from './forgot-password/forgot-password';
import { ResetPassword } from './reset-password/reset-password';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'welcome' },
  { path: 'welcome', component: Welcome },
  { path: 'login', component: LoginComponent },
  { path: 'pin/:role', component: PinLogin },
  { path: 'dashboard', component: Dashboard, canActivate: [roleGuard('doctor')] },
  { path: 'reception', component: Reception, canActivate: [roleGuard('receptionist')] },
  { path: 'pharmacy', component: Pharmacy, canActivate: [roleGuard('pharmacist')] },
  { path: 'lab', component: Lab, canActivate: [roleGuard('lab')] },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: '**', redirectTo: 'welcome' },
];