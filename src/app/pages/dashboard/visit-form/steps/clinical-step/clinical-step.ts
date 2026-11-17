import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SuggestField } from '../../../../../shared/suggest-field/suggest-field';
import { DashboardStore } from '../../../dashboard.store';
import { VisitFormData } from '../../visit-form.model';
import {
  COMORBIDITY_CHECKS,
  ComorbidityKey,
  EXAM_CHECKS,
  EXAM_NOTES,
  ExamCheckKey,
  YES_NO_QUESTIONS,
  YesNoField,
} from '../../visit-form.options';

// Step 2: symptoms, examination, comorbidities, investigations and disease.
@Component({
  selector: 'app-clinical-step',
  standalone: true,
  imports: [FormsModule, SuggestField],
  templateUrl: './clinical-step.html',
  styleUrls: ['../form-fields.css', './clinical-step.css'],
})
export class ClinicalStep {
  @Input({ required: true }) form!: VisitFormData;
  /** A tick box or a suggestion changed the form (typing is caught by the form itself). */
  @Output() changed = new EventEmitter<void>();

  readonly examChecks = EXAM_CHECKS;
  readonly examNotes = EXAM_NOTES;
  readonly comorbidityChecks = COMORBIDITY_CHECKS;
  readonly yesNoQuestions = YES_NO_QUESTIONS;

  constructor(readonly store: DashboardStore) {}

  toggleExam(key: ExamCheckKey): void {
    this.form.toggleExam(key);
    this.changed.emit();
  }

  toggleComorbidity(key: ComorbidityKey): void {
    this.form.toggleComorbidity(key);
    this.changed.emit();
  }

  setYesNo(field: YesNoField, value: 'Yes' | 'No'): void {
    this.form.setYesNo(field, value);
    this.changed.emit();
  }
}
