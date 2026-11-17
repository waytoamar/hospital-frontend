import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Visit, VisitService } from '../../../services/visit';
import { DashboardStore } from '../dashboard.store';
import { VisitFormRequest } from '../dashboard.models';
import { VisitFormData } from './visit-form.model';
import { FORM_STEPS } from './visit-form.options';
import { PatientStep } from './steps/patient-step/patient-step';
import { ClinicalStep } from './steps/clinical-step/clinical-step';
import { MedicinesStep } from './steps/medicines-step/medicines-step';
import { ReviewStep } from './steps/review-step/review-step';

const DRAFT_KEY = 'clinic-visit-draft-v2';

// New / edit visit, in 4 steps. A new visit is auto-saved as a draft on this computer.
@Component({
  selector: 'app-visit-form',
  standalone: true,
  imports: [DatePipe, PatientStep, ClinicalStep, MedicinesStep, ReviewStep],
  templateUrl: './visit-form.html',
  styleUrls: ['../dashboard-theme.css', './visit-form.css'],
})
export class VisitForm implements OnInit {
  @Input({ required: true }) request!: VisitFormRequest;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Visit>();

  readonly steps = FORM_STEPS;
  form = new VisitFormData();
  step = 1;
  editingId: string | null = null;
  nextPatientId = '';
  /** Date of the earlier visit the form was filled from */
  copiedFrom = '';
  saving = false;

  constructor(
    private store: DashboardStore,
    private visitService: VisitService,
  ) {}

  ngOnInit(): void {
    const visit = this.request.visit;

    if (this.request.mode === 'edit' && visit) {
      this.editingId = visit._id || null;
      this.form.fillAll(visit);
      // Empty visit registered by reception: start from the patient's last visit
      if (!visit.disease && !visit.diagnosis && !visit.medicines?.length) {
        this.copyFromLastVisit(visit, visit._id);
      }
    } else if (visit) {
      this.form.fillPatient(visit);
      this.copyFromLastVisit(visit);
    } else {
      this.restoreDraft();
    }

    this.visitService.getNextPatientId().subscribe({
      next: (result) => (this.nextPatientId = result.patientId),
      error: () => (this.nextPatientId = ''),
    });
  }

  // ---- Steps ----

  /** Any step tab can be opened directly; no need to fill the earlier steps first. */
  openStep(step: number): void {
    this.step = step;
    this.saveDraft();
  }

  next(): void {
    if (this.step === 1 && !this.form.patientValid) {
      alert('Enter patient name, valid age, gender and 10-digit phone number.');
      return;
    }
    this.saveDraft();
    this.step = Math.min(this.step + 1, this.steps.length);
  }

  back(): void {
    this.step = Math.max(this.step - 1, 1);
  }

  // ---- Close / save ----

  close(): void {
    if (this.form.hasData && !confirm('Close this form? Your auto-saved draft will be kept.')) {
      return;
    }
    this.closed.emit();
  }

  save(): void {
    if (!this.form.patientValid) {
      this.step = 1;
      alert('Enter patient name, valid age, gender and 10-digit phone number.');
      return;
    }
    if (this.saving || !confirm(this.editingId ? 'Update this visit?' : 'Save this visit?')) {
      return;
    }

    const visit = this.form.toVisit();
    const request = this.editingId
      ? this.visitService.updateVisit(this.editingId, visit)
      : this.visitService.addVisit(visit);

    this.saving = true;
    request.subscribe({
      next: (saved) => {
        this.saving = false;
        localStorage.removeItem(DRAFT_KEY);
        this.saved.emit(saved);
      },
      error: (error) => {
        this.saving = false;
        alert(error?.error?.message || 'Visit could not be saved.');
      },
    });
  }

  // ---- Draft (new visits only) ----

  saveDraft(): void {
    if (!this.editingId) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(this.form.toDraft()));
    }
  }

  private restoreDraft(): void {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) {
      return;
    }
    try {
      if (confirm('Continue your auto-saved visit draft?')) {
        this.form.fillAll(JSON.parse(saved) as Partial<Visit>);
        return;
      }
    } catch {
      // Broken draft: removed below
    }
    localStorage.removeItem(DRAFT_KEY);
  }

  private copyFromLastVisit(patient: Visit, excludeId?: string): void {
    const last = this.store.lastFilledVisit(patient, excludeId);
    if (last) {
      this.form.copyFromLastVisit(last);
      this.copiedFrom = last.visitDate || '';
    }
  }
}
