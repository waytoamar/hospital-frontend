import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Holiday, HolidayService } from '../../services/holiday';

// Clinic closed days. Used on the reception board and the doctor's dashboard.
// The WhatsApp bot does not offer these days and tells patients about them.
@Component({
  selector: 'app-holidays',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './holidays.html',
  styleUrl: './holidays.css',
})
export class Holidays implements OnInit {
  list: Holiday[] = [];

  day = '';
  reason = '';
  readonly quickReasons = ['Festival holiday', 'Doctor is not available'];

  open = false;
  busy = false;
  message = '';
  error = '';

  // Today on this computer (YYYY-MM-DD), so past dates cannot be picked
  readonly today = new Date().toLocaleDateString('en-CA');

  constructor(private api: HolidayService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.list().subscribe({
      next: (list) => (this.list = list),
      error: () => (this.error = 'Closed days could not be loaded.'),
    });
  }

  // "Sat, 24 Oct 2026"
  label(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  add(): void {
    this.message = '';
    this.error = '';
    if (!this.day) {
      this.error = 'Please choose a date.';
      return;
    }
    const reason = this.reason.trim() || 'Holiday';
    const ok = confirm(
      `Close the clinic on ${this.label(this.day)}?\n\n` +
        `Reason: ${reason}\n\n` +
        'WhatsApp bookings on that day will be cancelled and those patients will get a message.',
    );
    if (!ok) return;

    this.busy = true;
    this.api.add(this.day, reason).subscribe({
      next: (result) => {
        this.busy = false;
        this.message = result.cancelled
          ? `Saved. ${result.cancelled} WhatsApp booking(s) on that day were cancelled and the patients were informed.`
          : 'Saved. Patients on WhatsApp will see this day as closed.';
        this.day = '';
        this.reason = '';
        this.load();
      },
      error: (err) => {
        this.busy = false;
        this.error = err?.error?.message || 'Could not save. Please try again.';
      },
    });
  }

  remove(holiday: Holiday): void {
    if (!confirm(`Open the clinic again on ${this.label(holiday.day)}?`)) return;
    this.message = '';
    this.error = '';
    this.api.remove(holiday._id).subscribe({
      next: () => {
        this.message = `${this.label(holiday.day)} removed. Patients can book this day again.`;
        this.load();
      },
      error: () => (this.error = 'Could not remove. Please try again.'),
    });
  }
}
