import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SuggestField } from '../../../../../shared/suggest-field/suggest-field';
import { DashboardStore } from '../../../dashboard.store';
import { allergySummary, vitalsSummary } from '../../../visit-format';
import { VisitFormData } from '../../visit-form.model';
import { VISIT_STATUSES } from '../../visit-form.options';

// Step 4: short summary, follow-up date, status and advice.
@Component({
  selector: 'app-review-step',
  standalone: true,
  imports: [FormsModule, SuggestField],
  templateUrl: './review-step.html',
  styleUrls: ['../form-fields.css', './review-step.css'],
})
export class ReviewStep {
  @Input({ required: true }) form!: VisitFormData;
  @Input() nextPatientId = '';
  @Output() changed = new EventEmitter<void>();

  readonly statuses = VISIT_STATUSES;
  readonly vitalsSummary = vitalsSummary;

  constructor(readonly store: DashboardStore) {}

  get allergy(): string {
    return allergySummary({ allergies: this.form.allergies, comorbidities: this.form.comorbidities });
  }
}
