import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type StaffRole = 'receptionist' | 'pharmacist' | 'lab';

export interface StaffMember {
  _id: string;
  name: string;
  role: StaffRole;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class StaffAdminService {
  private readonly url = 'https://hospital-backend-yxe9.onrender.com/api/staff';

  private readonly options = {
    withCredentials: true,
  };

  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<StaffMember[]>(this.url, this.options);
  }

  add(name: string, role: StaffRole, pin: string) {
    return this.http.post<StaffMember>(this.url, { name, role, pin }, this.options);
  }

  // Send only what changes: a new name, a new PIN, or both
  update(id: string, changes: { name?: string; pin?: string }) {
    return this.http.put<StaffMember>(`${this.url}/${id}`, changes, this.options);
  }

  remove(id: string) {
    return this.http.delete(`${this.url}/${id}`, this.options);
  }
}