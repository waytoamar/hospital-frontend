import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { API_BASE } from '../../../services/api';
import { DashboardStore } from '../dashboard.store';
import { DaySummary, FeeChange } from './collections.models';

// Cash / UPI / total of the chosen day, and fee changes made by reception.
@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './collections.html',
  styleUrl: './collections.css',
})
export class Collections implements OnInit {
  summary: DaySummary | null = null;
  feeChanges: FeeChange[] = [];
  showChanges = false;
  date = new Date().toLocaleDateString('en-CA');

  readonly services = [
    { key: 'consultation', label: 'Consultation' },
    { key: 'rbs', label: 'RBS' },
    { key: 'ecg', label: 'ECG' },
    { key: 'xray', label: 'X-ray' },
    { key: 'daycare', label: 'Daycare' },
  ];

  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  constructor(private store: DashboardStore) {}

  ngOnInit(): void {
    this.load();
    this.store.serverChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  load(): void {
    const date = this.date || new Date().toLocaleDateString('en-CA');
    this.http
      .get<DaySummary>(`${API_BASE}/summary`, { params: { date }, withCredentials: true })
      .subscribe({
        next: (summary) => {
          this.summary = summary;
          if (summary.feeChanges) {
            this.loadFeeChanges(date);
          } else {
            this.feeChanges = [];
            this.showChanges = false;
          }
        },
        error: () => {},
      });
  }

  /** "Consultation ₹300 → ₹100, ECG ₹200 → ₹0" */
  itemDiff(change: FeeChange): string {
    const before = (key: string) => change.beforeFees?.[key] || 0;
    const after = (key: string) => change.afterFees?.[key] || 0;
    return this.services
      .filter((item) => before(item.key) !== after(item.key))
      .map((item) => `${item.label} ₹${before(item.key)} → ₹${after(item.key)}`)
      .join(', ');
  }

  payChanged(change: FeeChange): boolean {
    return change.beforeCash !== change.afterCash || change.beforeUpi !== change.afterUpi;
  }

  payText(cash: number, upi: number): string {
    const parts: string[] = [];
    if (cash) parts.push(`Cash ₹${cash}`);
    if (upi) parts.push(`UPI ₹${upi}`);
    return parts.join(' + ') || 'none';
  }

  private loadFeeChanges(date: string): void {
    this.http
      .get<FeeChange[]>(`${API_BASE}/fee-changes`, { params: { date }, withCredentials: true })
      .subscribe({
        next: (list) => (this.feeChanges = list),
        error: () => {},
      });
  }
}
