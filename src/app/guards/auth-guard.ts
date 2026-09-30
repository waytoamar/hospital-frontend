import { roleGuard } from './role-guard';

// Kept so old imports still work: the dashboard is doctor-only.
export const authGuard = roleGuard('doctor');
