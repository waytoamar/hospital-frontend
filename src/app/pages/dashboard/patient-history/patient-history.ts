import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Visit, isAbnormal } from '../../../services/visit';
import { DashboardStore } from '../dashboard.store';
import { allergySummary, vitalsSummary } from '../visit-format';

// Drawer on the right: every visit of one patient, newest first, with lab reports.
@Component({
  selector: 'app-patient-history',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './patient-history.html',
  styleUrls: ['../dashboard-theme.css', './patient-history.css'],
})
export class PatientHistory {
  readonly isAbnormal = isAbnormal;
  readonly vitalsSummary = vitalsSummary;
  readonly allergySummary = allergySummary;

  /** Lab report photo shown full screen */
  photo: string | null = null;

  constructor(readonly store: DashboardStore) {}

  get visits(): Visit[] {
    return this.store.selectedPatientVisits;
  }

  get patient(): Visit | undefined {
    return this.visits[0];
  }

  edit(visit: Visit): void {
    this.store.editVisit(visit);
    this.store.closePatient();
  }
}
