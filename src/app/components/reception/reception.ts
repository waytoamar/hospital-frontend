import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { DeskVitals, PatientHit, QueueItem, ReceptionService } from '../../services/staff';

interface Column {
  label: string;
  tone: 'waiting' | 'consult' | 'done';
  items: QueueItem[];
}

interface VisitForm {
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  vitals: DeskVitals;
}

const emptyForm = (): VisitForm => ({
  patientId: '',
  patientName: '',
  age: '',
  gender: '',
  phone: '',
  vitals: { bloodPressure: '', spo2: '', temperature: '', bloodSugar: '', weight: '', heartRate: '' },
});

@Component({
  selector: 'app-reception',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: '../staff-shared.css',
  template: `
    <header class="topbar">
      <div class="brand"><img class="logo-img sm" src="lungs.jpg" alt="" />
        <div><b>Chest &amp; Allergy Clinic</b><small>Reception</small></div></div>
      <div class="who">{{ name }} <button class="ghost" (click)="logout()">Logout</button></div>
    </header>

    <main class="page">
      <section class="calling" [class.idle]="!calling">
        <span>Now calling</span>
        <strong>{{ calling ? calling.token : '—' }}</strong>
        <small>{{ calling ? calling.patientName : 'No one with the doctor right now' }}</small>
      </section>

      <nav class="tabs">
        <button [class.active]="tab === 'board'" (click)="tab = 'board'">Board</button>
        <button [class.active]="tab === 'patients'" (click)="tab = 'patients'">Patients</button>
        <span class="refresh" *ngIf="updated">Updated {{ updated | date: 'shortTime' }} · auto-refresh 15s</span>
        <button class="primary-btn" (click)="openForm()">＋ New visit</button>
      </nav>

      <p class="notice ok" *ngIf="message">{{ message }}</p>

      <!-- BOARD -->
      <section *ngIf="tab === 'board'">
        <p class="error" *ngIf="loadError">{{ loadError }}</p>
        <div class="cols">
          <div class="col" *ngFor="let col of columns" [attr.data-tone]="col.tone">
            <h3>{{ col.label }} <span class="count">{{ col.items.length }}</span></h3>
            <div class="ticket" *ngFor="let v of col.items; trackBy: trackById">
              <span class="tok">{{ v.token }}</span>
              <div><b>{{ v.patientName }}</b><small>{{ v.age }} · {{ v.gender }} · {{ v.phone }}</small></div>
            </div>
            <p class="empty" *ngIf="!col.items.length">Nobody here</p>
          </div>
        </div>
      </section>

      <!-- PATIENTS -->
      <section *ngIf="tab === 'patients'" class="card">
        <h2>Find old patient</h2>
        <input placeholder="Name, phone or PT-ID" [(ngModel)]="search" (ngModelChange)="onSearch()" />
        <p class="error" *ngIf="phoneError">{{ phoneError }}</p>
        <p class="empty" *ngIf="searched && !hits.length">No patient found</p>
        <div class="hit" *ngFor="let p of hits">
          <div class="hit-info">
            <b>{{ p.patientName }}</b>
            <small>{{ p.patientId }} · {{ p.age }} · {{ p.gender }} · last visit {{ p.lastVisit | date: 'dd/MM/yyyy' }}</small>
            <ng-container *ngIf="phoneEdit?.id !== p.patientId; else editing">
              <small>📞 {{ p.phone }} <a class="link" (click)="phoneEdit = { id: p.patientId, value: p.phone }">Fix number</a></small>
            </ng-container>
            <ng-template #editing>
              <div class="inline">
                <input [(ngModel)]="phoneEdit!.value" maxlength="10" inputmode="numeric" />
                <button class="btn sm" (click)="savePhone(p)">Save</button>
                <button class="ghost" (click)="phoneEdit = null">Cancel</button>
              </div>
            </ng-template>
          </div>
          <button class="btn sm" (click)="openForm(p)">New visit</button>
        </div>
      </section>
    </main>

    <!-- NEW VISIT MODAL -->
    <div class="overlay" *ngIf="formOpen" (click)="closeForm()"></div>
    <section class="visit-modal" *ngIf="formOpen" role="dialog" aria-modal="true">
      <header>
        <div>
          <small>NEW RECORD</small>
          <h2>New patient visit</h2>
        </div>
        <button class="icon-btn" (click)="closeForm()" aria-label="Close">×</button>
      </header>

      <div class="modal-body">
        <div class="form-section">
          <div class="lookup-row">
            <label>Phone number *
              <input [(ngModel)]="form.phone" (ngModelChange)="onPhoneTyped()" maxlength="10"
                     inputmode="numeric" placeholder="10-digit mobile" />
            </label>
            <button class="outline-btn" (click)="findPatient()">Find patient</button>
          </div>

          <p class="found" *ngIf="lookupMsg">{{ lookupMsg }}</p>
          <div class="chip-list" *ngIf="matches.length > 1">
            <button *ngFor="let m of matches" class="pick" (click)="usePatient(m)">
              {{ m.patientName }} · {{ m.age }} · {{ m.patientId }}
            </button>
          </div>

          <label>Patient name *
            <input [(ngModel)]="form.patientName" placeholder="Full name" />
          </label>

          <div class="form-grid">
            <label>Age *
              <input [(ngModel)]="form.age" inputmode="numeric" maxlength="3" placeholder="Years" />
            </label>
            <label>Gender *
              <select [(ngModel)]="form.gender">
                <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
            </label>
          </div>

          <h4 class="sub-head">Vitals</h4>
          <div class="form-grid three">
            <label>BP<input [(ngModel)]="form.vitals.bloodPressure" placeholder="120/80" /></label>
            <label>SpO2<input [(ngModel)]="form.vitals.spo2" placeholder="%" /></label>
            <label>Temperature<input [(ngModel)]="form.vitals.temperature" placeholder="98.6 °F" /></label>
            <label>RBS<input [(ngModel)]="form.vitals.bloodSugar" placeholder="mg/dL" /></label>
            <label>Weight<input [(ngModel)]="form.vitals.weight" placeholder="kg" /></label>
            <label>Heart rate<input [(ngModel)]="form.vitals.heartRate" placeholder="bpm" /></label>
          </div>

          <p class="error" *ngIf="formError">{{ formError }}</p>
        </div>
      </div>

      <footer>
        <button class="outline-btn" (click)="closeForm()">Cancel</button>
        <button class="primary-btn" [disabled]="saving" (click)="submit()">
          {{ saving ? 'Saving…' : 'Register & get token' }}
        </button>
      </footer>
    </section>
  `,
})
export class Reception implements OnInit, OnDestroy {
  tab: 'board' | 'patients' = 'board';
  columns: Column[] = [];
  calling: QueueItem | null = null;
  updated: Date | null = null;
  loadError = '';
  message = '';

  formOpen = false;
  form: VisitForm = emptyForm();
  formError = '';
  lookupMsg = '';
  matches: PatientHit[] = [];
  saving = false;

  search = '';
  hits: PatientHit[] = [];
  searched = false;
  phoneEdit: { id: string; value: string } | null = null;
  phoneError = '';

  private refreshTimer?: ReturnType<typeof setInterval>;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(private api: ReceptionService, private auth: AuthService, private router: Router) {}

  get name(): string {
    return this.auth.getUsername();
  }

  ngOnInit(): void {
    this.load();
    this.refreshTimer = setInterval(() => this.load(), 15000);
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    clearTimeout(this.searchTimer);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.formOpen) this.closeForm();
  }

  trackById = (_: number, v: QueueItem) => v._id;

  private load(): void {
    this.api.board().subscribe({
      next: (visits) => {
        this.loadError = '';
        this.updated = new Date();
        const by = (status: string) => visits.filter((v) => v.status === status);
        this.columns = [
          { label: 'Waiting', tone: 'waiting', items: by('Waiting') },
          { label: 'In consultation', tone: 'consult', items: by('In consultation') },
          { label: 'Completed', tone: 'done', items: by('Completed') },
        ];
        this.calling = this.columns[1].items[0] || null;
      },
      error: (err) => {
        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/welcome']);
          return;
        }
        this.loadError = 'Could not refresh the queue. Retrying…';
      },
    });
  }

  // ---- New visit modal ----

  openForm(patient?: PatientHit): void {
    this.form = emptyForm();
    this.formError = '';
    this.lookupMsg = '';
    this.matches = [];
    this.message = '';
    if (patient) this.usePatient(patient);
    this.formOpen = true;
  }

  closeForm(): void {
    this.formOpen = false;
  }

  usePatient(p: PatientHit): void {
    this.form.patientId = p.patientId;
    this.form.patientName = p.patientName;
    this.form.age = p.age;
    this.form.gender = p.gender;
    this.form.phone = p.phone;
    this.lookupMsg = `Existing patient: ${p.patientName} (${p.patientId})`;
    this.matches = [];
  }

  // Typing a different number means this may be someone new
  onPhoneTyped(): void {
    if (this.form.patientId) {
      this.form.patientId = '';
      this.lookupMsg = '';
    }
  }

  findPatient(): void {
    this.formError = '';
    if (!/^\d{10}$/.test(this.form.phone)) {
      this.formError = 'Enter the 10-digit phone number first';
      return;
    }
    this.api.patients(this.form.phone).subscribe({
      next: (hits) => {
        const exact = hits.filter((h) => h.phone === this.form.phone);
        if (exact.length === 1) {
          this.usePatient(exact[0]);
        } else if (exact.length > 1) {
          this.matches = exact;
          this.lookupMsg = 'More than one patient uses this number. Pick one:';
        } else {
          this.lookupMsg = 'New patient. Fill in the details below.';
        }
      },
      error: () => (this.formError = 'Could not search right now'),
    });
  }

  submit(): void {
    const f = this.form;
    if (!f.patientName.trim() || !/^\d{1,3}$/.test(f.age) || !f.gender || !/^\d{10}$/.test(f.phone)) {
      this.formError = 'Enter name, age, gender and a 10-digit phone number';
      return;
    }
    this.saving = true;
    this.formError = '';
    this.api.addVisit({ ...f, patientName: f.patientName.trim(), patientId: f.patientId || undefined }).subscribe({
      next: (visit) => {
        this.saving = false;
        this.formOpen = false;
        this.tab = 'board';
        this.message = `${visit.patientName} added to the queue. Token ${visit.token}`;
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.formError = err?.error?.message || 'Could not add the patient';
      },
    });
  }

  // ---- Patients tab ----

  onSearch(): void {
    clearTimeout(this.searchTimer);
    const term = this.search.trim();
    if (term.length < 2) {
      this.hits = [];
      this.searched = false;
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.api.patients(term).subscribe({
        next: (hits) => { this.hits = hits; this.searched = true; },
        error: () => { this.hits = []; this.searched = true; },
      });
    }, 300);
  }

  savePhone(p: PatientHit): void {
    const phone = (this.phoneEdit?.value || '').trim();
    if (!/^\d{10}$/.test(phone)) {
      this.phoneError = 'Enter a 10-digit phone number';
      return;
    }
    this.api.updatePhone(p.patientId, phone).subscribe({
      next: () => {
        p.phone = phone;
        this.phoneEdit = null;
        this.phoneError = '';
        this.message = 'Phone number updated';
      },
      error: (err) => (this.phoneError = err?.error?.message || 'Could not update the number'),
    });
  }

  logout(): void {
    const leave = () => this.router.navigate(['/welcome']);
    this.auth.logout().subscribe({ next: leave, error: leave });
  }
}
