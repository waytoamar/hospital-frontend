import { environment } from '../environments/environment';

// The backend server's address, every page uses this one line.
// localhost:4200 (ng serve) -> http://localhost:5000/api   (src/environments/environment.development.ts)
// live build (ng build)     -> Render backend               (src/environments/environment.ts)
export const API_BASE = environment.apiBase;
