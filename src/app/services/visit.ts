import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export type VisitStatus =
  | 'Waiting'
  | 'In consultation'
  | 'Lab investigation'
  | 'Completed';

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
}

export interface Vitals {
  bloodPressure: string;
  temperature: string;
  weight: string;
  bloodSugar: string; // shown as RBS in the UI
  spo2?: string;
  heartRate?: string;
}

export interface Examination {
  anaemia: boolean;
  jaundice: boolean;
  clubbing: boolean;
  cyanosis: boolean;
  pedalEdema: boolean;
  lymphNode: boolean;
  nilSignificant?: boolean;
  cvs: string;
  rs: string;
  cns: string;
  gi: string;
}

export type YesNo = 'Yes' | 'No' | '';

export interface Comorbidities {
  nil?: boolean;
  htn: boolean;
  dm: boolean;
  cad: boolean;
  cva: boolean;
  allergy: boolean;
  atopy: boolean;
  asthma: boolean;
  copd: boolean;
  ild: boolean;
  drugAllergy: YesNo;
  drugAllergyDetails: string;
  surgicalComplications: YesNo;
  surgicalComplicationsNote: string;
}

export interface Visit {
  _id?: string;
  patientId?: string;
  phone: string;
  patientName: string;
  age: string;
  gender: string;
  disease: string;
  symptoms: string;
  diagnosis: string;
  allergies: string;
  vitals: Vitals;
  examination?: Examination;
  comorbidities?: Comorbidities;
  labInvestigations?: string;
  labResults?: LabResult[];
  labPhotos?: LabPhoto[];
  labSentAt?: string;
  labReady?: boolean;
  labReadyAt?: string;
  updatedAt?: string;
  comments?: string;
  medicines: Medicine[];
  followUpDate?: string;
  status: VisitStatus;
  visitDate?: string;
  token?: string;
  visitDay?: string;
}

@Injectable({
  providedIn: 'root',
})
export class VisitService {
  private readonly url = 'https://hospital-backend-yxe9.onrender.com/api/visits';

  private readonly options = {
    withCredentials: true,
  };

  constructor(private http: HttpClient) {}

    pulse() {
    return this.http.get<{ latest: string | null; count: number }>(
      `${this.url}/pulse`,
      this.options
    );
  }

  getVisits(startDate?: string, endDate?: string, search?: string) {
    let params = new HttpParams();

    if (startDate) {
      params = params.set('startDate', startDate);
    }

    if (endDate) {
      params = params.set('endDate', endDate);
    }

    if (search?.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<Visit[]>(this.url, {
      ...this.options,
      params,
    });
  }

  getNextPatientId() {
    return this.http.get<{ patientId: string }>(
      `${this.url}/next-id`,
      this.options
    );
  }

  addVisit(visit: Visit) {
    return this.http.post<Visit>(this.url, visit, this.options);
  }

  updateVisit(id: string, visit: Visit) {
    return this.http.put<Visit>(`${this.url}/${id}`, visit, this.options);
  }

  updateStatus(id: string, status: VisitStatus) {
    return this.http.patch<Visit>(
      `${this.url}/${id}/status`,
      { status },
      this.options
    );
  }

  // Receptionist: fix name / age / gender / phone / vitals of a visit (page 1 only)
  updateReceptionVisit(
    id: string,
    data: Pick<Visit, 'patientName' | 'age' | 'gender' | 'phone' | 'vitals'>
  ) {
    return this.http.put<Visit>(
      `https://hospital-backend-yxe9.onrender.com/api/reception/visits/${id}`,
      data,
      this.options
    );
  }

  deleteVisit(id: string) {
    return this.http.delete(`${this.url}/${id}`, this.options);
  }
}

// ------------------------------------------------------------------
// కొత్తగా చేర్చబడిన Lab Interfaces మరియు Utility Functions
// ------------------------------------------------------------------

export interface LabResult {
  name: string;
  result: string;
  range: string;
  done: boolean;
  abnormal?: boolean;
}

export interface LabPhoto {
  _id: string;
  data: string;
  uploadedAt: string;
}

export const splitTests = (text = ''): string[] =>
  text
    .split(/[,\n;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

// "12" with range "4-11" -> true (shown in red)
export function isAbnormal(result: string, range: string): boolean {
  const value = parseFloat(result);
  const match = String(range).match(
    /(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/i
  );
  if (Number.isNaN(value) || !match) return false;
  return value < Number(match[1]) || value > Number(match[2]);
}