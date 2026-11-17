import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Medicine } from '../../../../../services/visit';
import { DashboardStore } from '../../../dashboard.store';
import { VisitFormData } from '../../visit-form.model';
import { DOSAGE_OPTIONS, FREQUENCY_OPTIONS, TIMING_OPTIONS } from '../../visit-form.options';

// Step 3: medicines. Picking a medicine used before fills its dose, frequency, duration and timing.
@Component({
  selector: 'app-medicines-step',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './medicines-step.html',
  styleUrls: ['../form-fields.css', './medicines-step.css'],
})
export class MedicinesStep {
  @Input({ required: true }) form!: VisitFormData;
  @Output() changed = new EventEmitter<void>();

  readonly dosageOptions = DOSAGE_OPTIONS;
  readonly frequencyOptions = FREQUENCY_OPTIONS;
  readonly timingOptions = TIMING_OPTIONS;

  constructor(readonly store: DashboardStore) {}

  add(): void {
    this.form.addMedicine();
    this.changed.emit();
  }

  remove(index: number): void {
    this.form.removeMedicine(index);
    this.changed.emit();
  }

  /** Fills only empty boxes, so nothing the doctor typed is overwritten. */
  fillFromLastTime(medicine: Medicine): void {
    if (!medicine.name.trim() || medicine.dosage || medicine.frequency || medicine.duration || medicine.timing) {
      return;
    }
    const last = this.store.lastPrescription(medicine.name);
    if (last) {
      medicine.dosage = last.dosage || '';
      medicine.frequency = last.frequency || '';
      medicine.duration = last.duration || '';
      medicine.timing = last.timing || '';
      this.changed.emit();
    }
  }

  /** A saved value that is not in the fixed list is still shown in the drop-down. */
  isCustom(value: string, options: string[]): boolean {
    return !!value && !options.includes(value);
  }
}
