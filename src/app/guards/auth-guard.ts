import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Already login ayyi unte direct ga open
  if (authService.isLoggedIn()) {
    return true;
  }

  // Refresh chesinappudu cookie tho server ni check chestundi
  return authService.me().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};
