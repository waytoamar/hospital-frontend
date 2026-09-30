import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Visit, VisitStatus } from './visit';

const API = 'https://hospital-backend-yxe9.onrender.com/api';
const options = { withCredentials: true };

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
}

export interface PatientHit {
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  lastVisit: string;
}

export interface DeskVitals {
  bloodPressure: string;
  spo2: string;
  temperature: string;
  bloodSugar: string;
  weight: string;
  heartRate: string;
}

export interface NewVisitBody {
  patientId?: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  vitals?: DeskVitals;
}

@Injectable({ providedIn: 'root' })
export class ReceptionService {
  constructor(private http: HttpClient) {}

  board() {
    return this.http.get<QueueItem[]>(`${API}/reception/board`, options);
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

  updatePhone(patientId: string, phone: string) {
    return this.http.patch<{ patientId: string; phone: string }>(
      `${API}/reception/patients/${patientId}/phone`,
      { phone },
      options,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class PharmacyService {
  constructor(private http: HttpClient) {}

  queue(scope: 'today' | 'history') {
    return this.http.get<Visit[]>(`${API}/pharmacy/queue`, {
      ...options,
      params: new HttpParams().set('scope', scope),
    });
  }

  search(search: string) {
    return this.http.get<Visit[]>(`${API}/pharmacy/prescriptions`, {
      ...options,
      params: new HttpParams().set('search', search),
    });
  }
}
