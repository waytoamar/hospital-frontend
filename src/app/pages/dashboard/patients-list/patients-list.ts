import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DashboardStore } from '../dashboard.store';

// One row per patient; click the name to see the full history.
@Component({
  selector: 'app-patients-list',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './patients-list.html',
  styleUrls: ['../dashboard-theme.css', './patients-list.css'],
})
export class PatientsList {
  constructor(readonly store: DashboardStore) {}
}
