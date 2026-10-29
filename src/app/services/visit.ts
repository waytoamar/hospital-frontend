import { API_BASE } from '../api';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export type VisitStatus =
  | 'Waiting'
  | 'In consultation'
  | 'Lab investigation'
  | 'Completed'
  | 'No show';

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
  hypothyroidism?: boolean;
  drugAllergy: YesNo;
  drugAllergyDetails: string;
  surgicalComplications: YesNo;
  surgicalComplicationsNote: string;
  smoker?: YesNo;
  alcoholic?: YesNo;
}

export interface Referral {
  specialty: string; // e.g. Cardiologist
  to: string; // doctor / hospital (optional)
  reason: string; // e.g. MRI Brain, chest pain evaluation
  notes: string; // clinical details for them (optional)
}

export interface OutsideReport {
  _id: string;
  title?: string;
  data: string; // link to the photo
  uploadedAt?: string;
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
  // Referrals to other specialists outside the clinic (Cardiologist, Radiologist, Surgeon ...)
  referrals?: Referral[];
  // Photos of reports the patient brought from outside (MRI, CT, other hospital)
  outsideReports?: OutsideReport[];
  labResults?: LabResult[];
  labPhotos?: LabPhoto[];
  labSentAt?: string;
  labReady?: boolean;
  labReadyAt?: string;
  carriedFrom?: string;
  updatedAt?: string;
  comments?: string;
  medicines: Medicine[];
  followUpDate?: string;
  status: VisitStatus;
  visitDate?: string;
  token?: string;
  visitDay?: string;
  source?: string; // 'WhatsApp' when the patient booked on WhatsApp
  arrivedAt?: string | null; // WhatsApp patient reached the clinic (reception marks it)
}

@Injectable({
  providedIn: 'root',
})
export class VisitService {
  private readonly url = `${API_BASE}/visits`;

  private readonly options = {
    withCredentials: true,
  };

  constructor(private http: HttpClient) {}

  pulse() {
    return this.http.get<{ latest: string | null; count: number }>(
      `${this.url}/pulse`,
      this.options,
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

  // Only the visits that changed since the given time (quick refresh)
  getChangedVisits(since: string) {
    return this.http.get<Visit[]>(this.url, {
      ...this.options,
      params: new HttpParams().set('since', since),
    });
  }

  // Whole clinic data as one file (doctor only)
  downloadBackup() {
    return this.http.get(`${API_BASE}/backup`, {
      ...this.options,
      responseType: 'blob',
    });
  }

  getNextPatientId() {
    return this.http.get<{ patientId: string }>(`${this.url}/next-id`, this.options);
  }

  addVisit(visit: Visit) {
    return this.http.post<Visit>(this.url, visit, this.options);
  }

  updateVisit(id: string, visit: Visit) {
    return this.http.put<Visit>(`${this.url}/${id}`, visit, this.options);
  }

  updateStatus(id: string, status: VisitStatus) {
    return this.http.patch<Visit>(`${this.url}/${id}/status`, { status }, this.options);
  }

  // Is "send prescription on WhatsApp" switched on in the backend? (404 = WhatsApp not set up)
  whatsappFeatures() {
    return this.http.get<{ prescription: boolean }>(`${API_BASE}/whatsapp/features`);
  }

  // pdf: all referral letters of the visit as one PDF (base64 text)
  sendReferralPdf(id: string, pdf: string) {
    return this.http.post<{ sent: boolean; message: string }>(
      `${this.url}/${id}/referral-pdf`,
      { pdf },
      this.options,
    );
  }

  // Outside report photo (compressed JPEG data URL). Returns the visit's outside reports.
  addOutsideReport(id: string, data: string, title: string) {
    return this.http.post<OutsideReport[]>(
      `${this.url}/${id}/outside-reports`,
      { data, title },
      this.options,
    );
  }

  deleteOutsideReport(id: string, photoId: string) {
    return this.http.delete<OutsideReport[]>(
      `${this.url}/${id}/outside-reports/${photoId}`,
      this.options,
    );
  }

  // pdf: the prescription PDF as base64 text
  sendPrescriptionPdf(id: string, pdf: string) {
    return this.http.post<{ sent: boolean; message: string }>(
      `${this.url}/${id}/prescription-pdf`,
      { pdf },
      this.options,
    );
  }

  // Receptionist: fix name / age / gender / phone / vitals of a visit (page 1 only)
  updateReceptionVisit(
    id: string,
    data: Pick<Visit, 'patientName' | 'age' | 'gender' | 'phone' | 'vitals'>,
  ) {
    return this.http.put<Visit>(
      `${API_BASE}/reception/visits/${id}`,
      data,
      this.options,
    );
  }

  deleteVisit(id: string) {
    return this.http.delete(`${this.url}/${id}`, this.options);
  }
}

// ------------------------------------------------------------------
// Lab interfaces and utility functions
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
  const match = String(range).match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (Number.isNaN(value) || !match) return false;
  return value < Number(match[1]) || value > Number(match[2]);
}