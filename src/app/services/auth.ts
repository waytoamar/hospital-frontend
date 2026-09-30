import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

export type Role = 'doctor' | 'receptionist' | 'pharmacist';

export interface Doctor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  preferences: { defaultView: string };
}

// Doctor gets everything; staff only get name + photo
type Person = Partial<Doctor> & { displayName: string; avatarUrl: string };
interface SessionResponse {
  role?: Role;
  doctor: Person;
}

export const homeFor = (role: Role): string =>
  role === 'doctor' ? '/dashboard' : role === 'receptionist' ? '/reception' : '/pharmacy';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly url = 'https://hospital-backend-yxe9.onrender.com/api/auth';
  private doctor: Person | null = null;
  private role: Role | null = null;

  constructor(private http: HttpClient) {}

  private remember = (response: SessionResponse, fallback: Role = 'doctor') => {
    this.doctor = response.doctor;
    this.role = response.role || fallback;
  };

  login(username: string, password: string) {
    return this.http
      .post<SessionResponse>(`${this.url}/login`, { username, password }, { withCredentials: true })
      .pipe(tap((response) => this.remember(response, 'doctor')));
  }

  pinLogin(role: 'receptionist' | 'pharmacist', pin: string) {
    return this.http
      .post<SessionResponse>(`${this.url}/pin-login`, { role, pin }, { withCredentials: true })
      .pipe(tap((response) => this.remember(response, role)));
  }

  me() {
    return this.http
      .get<SessionResponse>(`${this.url}/me`, { withCredentials: true })
      .pipe(tap((response) => this.remember(response)));
  }

  isLoggedIn(): boolean {
    return this.doctor !== null;
  }

  getRole(): Role | null {
    return this.role;
  }

  getUsername(): string {
    return this.doctor?.displayName || this.doctor?.username || 'Doctor';
  }

  logout() {
    return this.http
      .post(`${this.url}/logout`, {}, { withCredentials: true })
      .pipe(tap(() => { this.doctor = null; this.role = null; }));
  }
}
