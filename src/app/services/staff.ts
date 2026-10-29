import { API_BASE } from '../api';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { LabResult, Visit, VisitStatus } from './visit';

const API = API_BASE;
const options = { withCredentials: true };

export interface DeskVitals {
  bloodPressure: string;
  spo2: string;
  temperature: string;
  bloodSugar: string;
  weight: string;
  heartRate: string;
}

export interface QueueItem {
  _id: string;
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  token: string;
  status: VisitStatus;
  visitDay: string;
  visitDate: string;
  vitals: DeskVitals;
  source?: string; // 'WhatsApp' when the patient booked on WhatsApp
  arrivedAt?: string | null; // WhatsApp patient reached the clinic
}

// WhatsApp booking for a coming day
export interface UpcomingBooking {
  _id: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  token: string;
  visitDay: string; // YYYY-MM-DD
}

export interface PatientHit {
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  lastVisit: string;
}

export interface NewVisitBody {
  patientId?: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  vitals?: DeskVitals;
}

export type ReceptionVisitUpdate = Pick<
  QueueItem,
  'patientName' | 'age' | 'gender' | 'phone' | 'vitals'
>;

@Injectable({ providedIn: 'root' })
export class ReceptionService {
  constructor(private http: HttpClient) {}

  board() {
    return this.http.get<QueueItem[]>(`${API}/reception/board`, options);
  }

  // WhatsApp bookings for tomorrow and later
  upcoming() {
    return this.http.get<UpcomingBooking[]>(`${API}/reception/upcoming`, options);
  }

  // WhatsApp patient reached the clinic (arrived = false undoes it)
  markArrived(id: string, arrived: boolean) {
    return this.http.patch<QueueItem>(`${API}/reception/visits/${id}/arrived`, { arrived }, options);
  }

  patients(search: string) {
    return this.http.get<PatientHit[]>(`${API}/reception/patients`, {
      ...options,
      params: new HttpParams().set('search', search),
    });
  }

  addVisit(body: NewVisitBody) {
    return this.http.post<QueueItem>(`${API}/reception/visits`, body, options);
  }

  updateVisit(id: string, body: ReceptionVisitUpdate) {
    return this.http.put<QueueItem>(`${API}/reception/visits/${id}`, body, options);
  }

  updatePhone(patientId: string, phone: string) {
    return this.http.patch<{
      patientId: string;
      phone: string;
    }>(`${API}/reception/patients/${patientId}/phone`, { phone }, options);
  }
}

@Injectable({ providedIn: 'root' })
export class PharmacyService {
  constructor(private http: HttpClient) {}

  // History can take From / To dates (YYYY-MM-DD)
  queue(scope: 'today' | 'history', from = '', to = '') {
    let params = new HttpParams().set('scope', scope);
    if (scope === 'history' && from) {
      params = params.set('from', from).set('to', to || from);
    }
    return this.http.get<Visit[]>(`${API}/pharmacy/queue`, { ...options, params });
  }

  search(search: string) {
    return this.http.get<Visit[]>(`${API}/pharmacy/prescriptions`, {
      ...options,
      params: new HttpParams().set('search', search),
    });
  }
}

// 2. ఫైల్ చివరన LabService చేర్చబడింది
@Injectable({ providedIn: 'root' })
export class LabService {
  constructor(private http: HttpClient) {}

  queue() {
    return this.http.get<Visit[]>(`${API}/lab/queue`, options);
  }

  saveResults(id: string, results: LabResult[]) {
    return this.http.put<Visit>(`${API}/lab/visits/${id}/results`, { results }, options);
  }

  addPhoto(id: string, data: string) {
    return this.http.post<Visit>(`${API}/lab/visits/${id}/photos`, { data }, options);
  }

  deletePhoto(id: string, photoId: string) {
    return this.http.delete<Visit>(`${API}/lab/visits/${id}/photos/${photoId}`, options);
  }

  ready(id: string, results: LabResult[]) {
    return this.http.post<{ ok: boolean }>(`${API}/lab/visits/${id}/ready`, { results }, options);
  }
}
