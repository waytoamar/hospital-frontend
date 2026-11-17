import { Component, EventEmitter, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DashboardStore } from '../dashboard.store';

const TITLES = {
  board: "Today's board",
  patients: 'Patients',
  records: 'Records',
  holidays: 'Clinic closed days',
} as const;

// Top bar: screen title, date, letterhead tick box, clock, now calling, doctor's initial.
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar {
  @Output() menu = new EventEmitter<void>();

  constructor(readonly store: DashboardStore) {}

  get title(): string {
    return TITLES[this.store.activeView];
  }

  get initial(): string {
    return (this.store.username || '?').trim().charAt(0).toUpperCase();
  }

  onPaperChange(event: Event): void {
    this.store.setPreprintedPaper((event.target as HTMLInputElement).checked);
  }
}
