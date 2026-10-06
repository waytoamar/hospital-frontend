import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { Medicine, Visit } from '../../services/visit';
import { PharmacyService } from '../../services/staff';
import { printPrescription } from '../../services/prescription-print';

@Component({
  selector: 'app-pharmacy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './pharmacy.css',
  template: `
    <div class="desk-banner"><span class="ico">💊</span> Pharmacy Desk</div>

    <header class="topbar">
      <div class="brand">
        <img class="logo-img" src="lungs.jpg" alt="" />
        <div><b>Chest &amp; Allergy Clinic</b><small>Pharmacy Desk</small></div>
      </div>

      <label class="search">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M20 20l-3.5-3.5"></path>
        </svg>
        <input
          placeholder="Search token, patient name or phone…"
          [(ngModel)]="search"
          (ngModelChange)="onSearch()"
        />
      </label>

      <div class="who">
        <div>
          <b>{{ name }}</b>
        </div>
        <button class="logout" (click)="logout()">Logout ⇥</button>
      </div>
    </header>

    <main class="page">
      <div class="head">
        <div>
          <p class="date">{{ now | date: 'EEEE, d MMMM' }}</p>
          <h1>
            {{
              searching
                ? 'Search results'
                : tab === 'today'
                  ? 'Completed Consultations'
                  : 'Recent Prescriptions'
            }}
          </h1>
          <p class="lead">
            Doctor-completed prescriptions appear here automatically. View the details and print.
          </p>
        </div>
        <div class="toggle">
          <button [class.on]="tab === 'today'" (click)="setTab('today')">Active Queue</button>
          <button [class.on]="tab === 'history'" (click)="setTab('history')">History</button>
        </div>
      </div>

      <p class="error" *ngIf="error">{{ error }}</p>

      <section class="table">
        <div class="thead">
          <span>Token</span><span>Patient details</span><span>Diagnosis summary</span>
          <span>Rx items</span><span>Status</span><span class="end">Actions</span>
        </div>

        <div class="trow" *ngFor="let v of rows; trackBy: trackById">
          <div class="c-token">
            <b>{{ v.token || '—' }}</b>
            <small>{{
              v.visitDate | date: (tab === 'today' && !searching ? 'h:mm a' : 'dd MMM, h:mm a')
            }}</small>
          </div>
          <div class="c-patient">
            <b>{{ v.patientName }}</b>
            <small>{{ v.age }} · {{ v.gender }} · {{ v.phone }}</small>
          </div>
          <div class="c-diag">{{ v.diagnosis || v.disease || '—' }}</div>
          <div>
            <span class="pill">{{
              v.medicines.length
                ? v.medicines.length + ' medication' + (v.medicines.length === 1 ? '' : 's')
                : 'No medicines'
            }}</span>
          </div>
          <div class="c-status"><i></i>Ready to dispense</div>
          <div class="c-actions">
            <button class="link" (click)="detail = v">👁 View details</button>
            <button class="go" (click)="print(v)">
              {{ v.medicines.length ? 'Print prescription' : 'Advice only · print' }}
            </button>
          </div>
        </div>

        <p class="empty" *ngIf="!rows.length && !loading">
          {{
            searching
              ? 'No prescription found'
              : tab === 'today'
                ? 'No completed consultations yet today'
                : 'No prescriptions yet'
          }}
        </p>
      </section>

      <section class="cards">
        <div class="card green">
          <small>READY TO DISPENSE TODAY</small>
          <strong>{{ todayCount }}</strong>
          <span>Completed by the doctor today</span>
        </div>
        <div class="card cream">
          <small>AUTO REFRESH</small>
          <strong class="sm">Every 10 seconds</strong>
          <span>Last updated {{ updated ? (updated | date: 'h:mm:ss a') : '…' }}</span>
        </div>
      </section>
    </main>

    <footer class="foot">
      <span>Chest &amp; Allergy Clinic · Pharmacy system</span>
      <span><i></i> System online</span>
    </footer>

    <!-- DETAILS -->
    <div class="overlay" *ngIf="detail" (click)="detail = null"></div>
    <section class="modal" *ngIf="detail" role="dialog" aria-modal="true">
      <header>
        <div>
          <small>{{ detail.token }} · {{ detail.visitDate | date: 'dd MMM yyyy, h:mm a' }}</small>
          <h2>{{ detail.patientName }}</h2>
          <p>{{ detail.age }} · {{ detail.gender }} · {{ detail.phone }}</p>
        </div>
        <button class="x" (click)="detail = null" aria-label="Close">×</button>
      </header>

      <div class="body">
        <p class="label">Diagnosis</p>
        <p>{{ detail.diagnosis || detail.disease || '—' }}</p>

        <p class="label" *ngIf="detail.allergies">Allergies</p>
        <p *ngIf="detail.allergies">{{ detail.allergies }}</p>

        <p class="label">Medicines</p>
        <p *ngIf="!detail.medicines.length">No medicines — advice only</p>
        <div class="med" *ngFor="let m of detail.medicines; let i = index">
          <span class="n">{{ i + 1 }}</span>
          <div>
            <b>{{ m.name }}</b>
            <small>{{ medLine(m) }}</small>
          </div>
        </div>

        <ng-container *ngIf="detail.followUpDate">
          <p class="label">Follow-up</p>
          <p>{{ detail.followUpDate | date: 'dd MMM yyyy' }}</p>
        </ng-container>
      </div>

      <footer>
        <button class="ghost" (click)="detail = null">Close</button>
        <button class="go" (click)="print(detail)">Print prescription</button>
      </footer>
    </section>
  `,
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

  // Opens the full prescription paper (same as the doctor's) and starts printing
  print(visit: Visit): void {
    printPrescription(visit);
  }

  logout(): void {
    const leave = () => this.router.navigate(['/welcome']);
    this.auth.logout().subscribe({ next: leave, error: leave });
  }
}