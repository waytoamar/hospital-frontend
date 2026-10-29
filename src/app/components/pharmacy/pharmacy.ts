import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { Medicine, Visit } from '../../services/visit';
import { PharmacyService } from '../../services/staff';
import {
  isPreprintedPaper,
  printPrescription,
  setPreprintedPaper,
} from '../../services/prescription-print';

@Component({
  selector: 'app-pharmacy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './pharmacy.css',
  templateUrl: './pharmacy.html',
})
export class Pharmacy implements OnInit, OnDestroy {
  tab: 'today' | 'history' = 'today';
  search = '';
  rows: Visit[] = [];
  detail: Visit | null = null;
  todayCount = 0;
  loading = false;
  error = '';
  updated: Date | null = null;
  now = new Date();
  // Print on paper that already has the clinic header: header is not printed
  preprintedPaper = isPreprintedPaper();

  private refreshTimer?: ReturnType<typeof setInterval>;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private api: PharmacyService,
    private auth: AuthService,
    private router: Router,
  ) {}

  get name(): string {
    return this.auth.getUsername();
  }

  get searching(): boolean {
    return this.search.trim().length > 0;
  }

  ngOnInit(): void {
    this.refresh();
    // Keeps the "today" board up to date when the doctor completes a visit
    this.refreshTimer = setInterval(() => {
      if (!this.searching && !this.detail) this.refresh();
    }, 10000);
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    clearTimeout(this.searchTimer);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.detail = null;
  }

  trackById = (_: number, v: Visit) => v._id;

  medLine(m: Medicine): string {
    return [m.dosage, m.frequency, m.duration, m.timing].filter(Boolean).join(' · ');
  }

  setTab(tab: 'today' | 'history'): void {
    this.tab = tab;
    this.search = '';
    this.refresh();
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.refresh(), 300);
  }

  private refresh(): void {
    this.loading = true;
    const term = this.search.trim();
    const request = term ? this.api.search(term) : this.api.queue(this.tab);
    request.subscribe({
      next: (rows) => {
        this.loading = false;
        this.error = '';
        this.rows = rows;
        this.updated = new Date();
        this.now = new Date();
        if (!term && this.tab === 'today') this.todayCount = rows.length;
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/welcome']);
          return;
        }
        this.error = 'Could not load prescriptions. Retrying…';
      },
    });
  }

  togglePreprinted(event: Event): void {
    this.preprintedPaper = (event.target as HTMLInputElement).checked;
    setPreprintedPaper(this.preprintedPaper);
  }

  // Opens the full prescription paper (same as the doctor's) and starts printing
  print(visit: Visit): void {
    printPrescription(visit);
  }

  logout(): void {
    const leave = () => this.router.navigate(['/welcome']);
    this.auth.logout().subscribe({ next: leave, error: leave });
  }
}