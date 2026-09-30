import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService, Role, homeFor } from '../services/auth';

// Lets only the given role in. Others go to their own screen, or to the start page.
export const roleGuard = (allowed: Role): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const decide = () => {
    const role = auth.getRole();
    if (role === allowed) return true;
    return router.parseUrl(role ? homeFor(role) : '/welcome');
  };

  if (auth.getRole()) return decide();
  return auth.me().pipe(
    map(decide),
    catchError(() => of(router.parseUrl('/welcome'))),
  );
};
