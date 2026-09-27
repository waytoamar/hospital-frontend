import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

export interface Doctor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  preferences: { defaultView: string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly url = 'https://hospital-backend-yxe9.onrender.com/api/auth';
  private doctor: Doctor | null = null;

  constructor(private http: HttpClient) {}

  login(username: string, password: string) {
    return this.http
      .post<{ doctor: Doctor }>(
        `${this.url}/login`,
        { username, password },
        { withCredentials: true }
      )
      .pipe(tap((response) => (this.doctor = response.doctor)));
  }

  me() {
    return this.http
      .get<{ doctor: Doctor }>(`${this.url}/me`, { withCredentials: true })
      .pipe(tap((response) => (this.doctor = response.doctor)));
  }

    isLoggedIn(): boolean {
    return this.doctor !== null;
  }


  getUsername(): string {
    return this.doctor?.displayName || this.doctor?.username || 'Doctor';
  }

  logout() {
    return this.http
      .post(`${this.url}/logout`, {}, { withCredentials: true })
      .pipe(tap(() => (this.doctor = null)));
  }
}
