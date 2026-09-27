import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface Medicine {
  name: string;
  dosage: string;
  timing: string;
}

export interface Visit {
  _id?: string;
  patientName: string;
  age: string;
  gender: string;
  disease: string;
  symptoms: string;
  diagnosis: string;
  labInvestigations?: string;
  comments?: string;
  medicines: Medicine[];
  visitDate?: string;
}

@Injectable({ providedIn: 'root' })
export class VisitService {
  private readonly url = 'https://hospital-backend-yxe9.onrender.com/api/visits';
  private readonly options = { withCredentials: true };

  constructor(private http: HttpClient) {}

  getVisits(startDate?: string, endDate?: string) {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);

    return this.http.get<Visit[]>(this.url, {
      ...this.options,
      params,
    });
  }

  addVisit(visit: Visit) {
    return this.http.post<Visit>(this.url, visit, this.options);
  }

  updateVisit(id: string, visit: Visit) {
    return this.http.put<Visit>(`${this.url}/${id}`, visit, this.options);
  }

  deleteVisit(id: string) {
    return this.http.delete(`${this.url}/${id}`, this.options);
  }
}