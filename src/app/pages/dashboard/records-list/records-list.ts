import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Visit } from '../../../services/visit';
import { ExcelExportService } from '../../../services/excel-export.service';
import { DashboardStore } from '../dashboard.store';

// Every saved visit, with a From / To date filter and Excel export.
@Component({
  selector: 'app-records-list',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './records-list.html',
  styleUrls: ['../dashboard-theme.css', './records-list.css'],
})
export class RecordsList {
  from = '';
  to = '';

  constructor(
    readonly store: DashboardStore,
    private excel: ExcelExportService,
  ) {}

  get visits(): Visit[] {
    return this.store.visits.filter((visit) => this.store.matchesSearch(visit) && this.inDates(visit));
  }

  clearDates(): void {
    this.from = '';
    this.to = '';
  }

  exportToExcel(): void {
    const visits = this.visits;
    if (!visits.length) {
      alert('No records to export.');
      return;
    }
    this.excel.exportVisits(visits);
  }

  private inDates(visit: Visit): boolean {
    if (!this.from && !this.to) {
      return true;
    }
    if (!visit.visitDate) {
      return false;
    }
    const day = new Date(visit.visitDate).toLocaleDateString('en-CA');
    return (!this.from || day >= this.from) && (!this.to || day <= this.to);
  }
}
