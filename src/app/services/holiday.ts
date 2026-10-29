import { API_BASE } from '../api';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// A day the clinic is closed (festival, doctor not available ...)
export interface Holiday {
  _id: string;
  day: string; // YYYY-MM-DD
  reason: string;
  addedBy?: string;
}

@Injectable({
  providedIn: 'root',
})
export class HolidayService {
  private readonly url = `${API_BASE}/holidays`;

  private readonly options = {
    withCredentials: true,
  };

  constructor(private http: HttpClient) {}

  // Today and later
  list() {
    return this.http.get<Holiday[]>(this.url, this.options);
  }

  // cancelled = WhatsApp bookings on that day that were cancelled (those patients get a message)
  add(day: string, reason: string) {
    return this.http.post<{ holiday: Holiday; cancelled: number }>(
      this.url,
      { day, reason },
      this.options,
    );
  }

  remove(id: string) {
    return this.http.delete<{ ok: boolean }>(`${this.url}/${id}`, this.options);
  }
}
