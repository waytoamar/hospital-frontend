import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DashboardStore } from '../../../dashboard.store';
import { VisitFormData } from '../../visit-form.model';

// Step 1: patient details and vitals.
@Component({
  selector: 'app-patient-step',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './patient-step.html',
  styleUrls: ['../form-fields.css', './patient-step.css'],
})
export class PatientStep {
  @Input({ required: true }) form!: VisitFormData;
  @Input() nextPatientId = '';

  constructor(private store: DashboardStore) {}

  /** Loads name, age, gender and allergy of a patient seen before. */
  findPatient(): void {
    const patient = this.store.findPatient(this.form.phone, this.form.patientId);
    if (!patient) {
      alert('No previous patient found. Continue as a new patient.');
      return;
    }
    this.form.fillPatient(patient);
    alert('Patient details loaded.');
  }
}
