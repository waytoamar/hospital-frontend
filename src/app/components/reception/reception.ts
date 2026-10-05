import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { DeskVitals, PatientHit, QueueItem, ReceptionService } from '../../services/staff';
import { SpeechService } from '../../services/speech.service';
import { HttpClient } from '@angular/common/http';

const API = 'https://hospital-backend-yxe9.onrender.com/api';

interface Column {
  label: string;
  tone: 'waiting' | 'consult' | 'lab' | 'done';
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

const emptyVitals = (): DeskVitals => ({
  bloodPressure: '',
  spo2: '',
  temperature: '',
  bloodSugar: '',
  weight: '',
  heartRate: '',
});

const emptyForm = (): VisitForm => ({
  patientId: '',
  patientName: '',
  age: '',
  gender: '',
  phone: '',
  vitals: emptyVitals(),
});

@Component({
  selector: 'app-reception',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['../staff-shared.css'],
  styles: [
    `
      .ticket-info {
        flex: 1;
        min-width: 0;
      }
      .edit-btn {
        border: 1px solid var(--line);
        background: #fff;
        color: var(--muted);
        border-radius: 8px;
        padding: 5px 10px;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .edit-btn:hover {
        border-color: var(--primary);
        color: var(--primary-dark);
      }
      .ticket-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: stretch;
      }
      .noshow-btn {
        border: 1px solid #f0c4be;
        background: #fff5f4;
        color: #b42318;
        border-radius: 8px;
        padding: 5px 10px;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .noshow-btn:hover {
        background: #fdecea;
      }
      .noshow-btn:disabled {
        opacity: 0.5;
        cursor: wait;
      }
      .at-lab {
        margin-top: 16px;
        background: #fff;
        border: 1px solid var(--line);
        border-top: 5px solid #7b61c9;
        border-radius: 14px;
        padding: 12px 14px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
      }
      .at-lab h4 {
        margin: 0 6px 0 0;
        font-size: 15px;
      }
      .lab-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #ece6fa;
        color: #3f2f7a;
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 13px;
      }
      .reports-badge {
        display: block;
        width: fit-content;
        max-width: 100%;
        margin: 4px 0 2px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 600;
        color: #0f7a3d;
        background: #e3f6ea;
        border: 1px solid #9ad6b0;
        border-radius: 999px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
      }
      .voice-btn {
        border: 1px solid var(--line);
        background: #fff;
        border-radius: 999px;
        padding: 8px 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .voice-btn.on {
        background: #e3f6ea;
        border-color: #9ad6b0;
        color: #0f7a3d;
      }
      .voice-banner {
        display: block;
        width: 100%;
        margin: 0 0 16px;
        padding: 14px 18px;
        border: 2px dashed #e0a100;
        background: #fff8e1;
        color: #7a5200;
        border-radius: 14px;
        font: inherit;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }
      .voice-banner:hover {
        background: #fff1c2;
      }
    `,
  ],
  template: `
    <header class="topbar">
      <div class="brand">
        <img class="logo-img sm" src="lungs.jpg" alt="" />
        <div><b>Chest &amp; Allergy Clinic</b><small>Reception</small></div>
      </div>
      <div class="who">{{ name }} <button class="ghost" (click)="logout()">Logout</button></div>
    </header>

    <main class="page">
      <section class="calling" [class.idle]="!calling">
        <span>Now calling</span>
        <strong>{{ calling ? calling.token : '—' }}</strong>
        <small>{{ calling ? calling.patientName : 'No one with the doctor right now' }}</small>
      </section>

      <button class="voice-banner" *ngIf="!voiceEnabled" (click)="toggleVoice()">
        🔇 Voice is OFF. Click here once to turn on patient calling voice
      </button>

      <nav class="tabs">
        <button [class.active]="tab === 'board'" (click)="tab = 'board'">Board</button>
        <button [class.active]="tab === 'patients'" (click)="tab = 'patients'">Patients</button>
        <span class="refresh" *ngIf="updated"
          >Updated {{ updated | date: 'shortTime' }} · auto-refresh 5s</span
        >
        <button class="voice-btn" [class.on]="voiceEnabled" (click)="toggleVoice()">
          {{ voiceEnabled ? '🔊 Voice on' : '🔇 Enable voice' }}
        </button>
        <button class="primary-btn" (click)="openForm()">＋ New visit</button>
      </nav>

      <p class="notice ok" *ngIf="message">{{ message }}</p>

      <!-- BOARD -->
      <section *ngIf="tab === 'board'">
        <p class="error" *ngIf="loadError">{{ loadError }}</p>
        <div class="cols">
          <div class="col" *ngFor="let col of columns" [attr.data-tone]="col.tone">
            <h3>
              {{ col.label }} <span class="count">{{ col.items.length }}</span>
            </h3>
            <div class="ticket" *ngFor="let v of col.items; trackBy: trackById">
              <span class="tok">{{ v.token }}</span>
              <div class="ticket-info">
                <b>{{ v.patientName }}</b>
                <span class="reports-badge" *ngIf="isReportsReady(v)">🧪 Reports ready</span>
                <small>{{ v.age }} · {{ v.gender }} · {{ v.phone }}</small>
              </div>
              <div class="ticket-actions">
                <button class="edit-btn" (click)="openEdit(v)" aria-label="Edit patient details">
                  ✎ Edit
                </button>
                <button
                  class="noshow-btn"
                  *ngIf="v.status === 'Waiting'"
                  [disabled]="busyId === v._id"
                  (click)="markNoShow(v)"
                  title="Patient did not come"
                >
                  ✕ No show
                </button>
              </div>
            </div>
            <p class="empty" *ngIf="!col.items.length">Nobody here</p>
          </div>
        </div>

        <div class="at-lab" *ngIf="atLab.length">
          <h4>
            🧪 At lab <span class="count">{{ atLab.length }}</span>
          </h4>
          <span class="lab-chip" *ngFor="let v of atLab; trackBy: trackById">
            <b>{{ v.token }}</b> {{ v.patientName }}
          </span>
        </div>
      </section>

      <!-- PATIENTS -->
      <section *ngIf="tab === 'patients'" class="card">
        <h2>Find old patient</h2>
        <input
          placeholder="Name, phone or PT-ID"
          [(ngModel)]="search"
          (ngModelChange)="onSearch()"
        />
        <p class="error" *ngIf="phoneError">{{ phoneError }}</p>
        <p class="empty" *ngIf="searched && !hits.length">No patient found</p>
        <div class="hit" *ngFor="let p of hits">
          <div class="hit-info">
            <b>{{ p.patientName }}</b>
            <small
              >{{ p.patientId }} · {{ p.age }} · {{ p.gender }} · last visit
              {{ p.lastVisit | date: 'dd/MM/yyyy' }}</small
            >
            <ng-container *ngIf="phoneEdit?.id !== p.patientId; else editing">
              <small
                >📞 {{ p.phone }}
                <a class="link" (click)="phoneEdit = { id: p.patientId, value: p.phone }"
                  >Fix number</a
                ></small
              >
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

    <!-- NEW / EDIT VISIT MODAL -->
    <div class="overlay" *ngIf="formOpen" (click)="closeForm()"></div>
    <section class="visit-modal" *ngIf="formOpen" role="dialog" aria-modal="true">
      <header>
        <div>
          <small>{{ editingId ? 'EDIT RECORD' : 'NEW RECORD' }}</small>
          <h2>{{ editingId ? 'Edit patient details' : 'New patient visit' }}</h2>
        </div>
        <button class="icon-btn" (click)="closeForm()" aria-label="Close">×</button>
      </header>

      <div class="modal-body">
        <div class="form-section">
          <div class="lookup-row" *ngIf="!editingId; else phoneOnly">
            <label
              >Phone number *
              <input
                [(ngModel)]="form.phone"
                (ngModelChange)="onPhoneTyped()"
                maxlength="10"
                inputmode="numeric"
                placeholder="10-digit mobile"
              />
            </label>
            <button class="outline-btn" (click)="findPatient()">Find patient</button>
          </div>
          <ng-template #phoneOnly>
            <label
              >Phone number *
              <input
                [(ngModel)]="form.phone"
                maxlength="10"
                inputmode="numeric"
                placeholder="10-digit mobile"
              />
            </label>
          </ng-template>

          <p class="found" *ngIf="lookupMsg">{{ lookupMsg }}</p>
          <div class="chip-list" *ngIf="matches.length > 1">
            <button *ngFor="let m of matches" class="pick" (click)="usePatient(m)">
              {{ m.patientName }} · {{ m.age }} · {{ m.patientId }}
            </button>
          </div>

          <label
            >Patient name *
            <input [(ngModel)]="form.patientName" placeholder="Full name" />
          </label>

          <div class="form-grid">
            <label
              >Age *
              <input [(ngModel)]="form.age" inputmode="numeric" maxlength="3" placeholder="Years" />
            </label>
            <label
              >Gender *
              <select [(ngModel)]="form.gender">
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </label>
          </div>

          <h4 class="sub-head">Vitals</h4>
          <div class="form-grid three">
            <label>BP<input [(ngModel)]="form.vitals.bloodPressure" placeholder="120/80" /></label>
            <label>SpO2<input [(ngModel)]="form.vitals.spo2" placeholder="%" /></label>
            <label
              >Temperature<input [(ngModel)]="form.vitals.temperature" placeholder="98.6 °F"
            /></label>
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
          {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Register & get token' }}
        </button>
      </footer>
    </section>
  `,
})
export class Reception implements OnInit, OnDestroy {
  tab: 'board' | 'patients' = 'board';
  columns: Column[] = [];
  atLab: QueueItem[] = [];
  calling: QueueItem | null = null;
  updated: Date | null = null;
  loadError = '';
  message = '';
  busyId: string | null = null;

  formOpen = false;
  form: VisitForm = emptyForm();
  editingId: string | null = null;
  formError = '';
  lookupMsg = '';
  matches: PatientHit[] = [];
  saving = false;

  search = '';
  hits: PatientHit[] = [];
  searched = false;
  phoneEdit: { id: string; value: string } | null = null;
  phoneError = '';

  voiceEnabled = false;
  private lastCalledId: string | null = null;

  private refreshTimer?: ReturnType<typeof setInterval>;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private api: ReceptionService,
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
    private speech: SpeechService,
  ) {}

  get name(): string {
    return this.auth.getUsername();
  }

  ngOnInit(): void {
    this.load();
    this.refreshTimer = setInterval(() => this.load(), 5000);
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

  // ---- Reports ready + Voice ----

  isReportsReady(v: QueueItem): boolean {
    const x = v as QueueItem & { labReady?: boolean };
    return !!x.labReady && v.status !== 'Completed';
  }

  toggleVoice(): void {
    this.voiceEnabled = !this.voiceEnabled;
    if (this.voiceEnabled) {
      this.speech.unlock();
      this.speech.speak('Voice announcements enabled', 1);
    }
  }

  private announceIfNew(): void {
    if (!this.calling) {
      this.lastCalledId = null;
      return;
    }
    const id = this.calling._id || null;
    if (id === this.lastCalledId) return;
    this.lastCalledId = id;

    if (!this.voiceEnabled) return;

    const spokenToken = String(this.calling.token)
      .replace(/[^A-Za-z0-9]/g, '')
      .split('')
      .join(' ');
    this.speech.speak(
      `Calling token ${spokenToken}, ${this.calling.patientName}. Please go to the doctor.`,
    );
  }

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
        this.atLab = by('Lab investigation');
        this.calling = this.columns[1].items[0] || null;
        this.announceIfNew();
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

  // Patient took a token but did not come: remove from the waiting list.
  // The record stays in history; if the patient comes later, register a new visit.
  markNoShow(v: QueueItem): void {
    if (!v._id || this.busyId) return;
    if (!confirm(`Mark ${v.patientName} (${v.token}) as No show?`)) return;
    this.busyId = v._id;
    this.http
      .patch(`${API}/reception/visits/${v._id}/no-show`, {}, { withCredentials: true })
      .subscribe({
        next: () => {
          this.busyId = null;
          this.message = `${v.patientName} marked as No show.`;
          this.load();
        },
        error: (err) => {
          this.busyId = null;
          if (err.status === 401 || err.status === 403) {
            this.router.navigate(['/welcome']);
            return;
          }
          this.loadError = err?.error?.message || 'Could not update. Please try again.';
          this.load();
        },
      });
  }

  // ---- New visit modal ----

  openForm(patient?: PatientHit): void {
    this.form = emptyForm();
    this.editingId = null;
    this.formError = '';
    this.lookupMsg = '';
    this.matches = [];
    this.message = '';
    if (patient) this.usePatient(patient);
    this.formOpen = true;
  }

  // ---- Edit visit (page 1 only: name, age, gender, phone, vitals) ----

  openEdit(v: QueueItem): void {
    const vit = (v as QueueItem & { vitals?: Partial<DeskVitals> }).vitals || {};
    this.form = {
      patientId: v.patientId || '',
      patientName: v.patientName || '',
      age: String(v.age || ''),
      gender: v.gender || '',
      phone: v.phone || '',
      vitals: { ...emptyVitals(), ...vit } as DeskVitals,
    };
    this.editingId = v._id || null;
    this.formError = '';
    this.lookupMsg = '';
    this.matches = [];
    this.message = '';
    this.formOpen = true;
  }

  closeForm(): void {
    this.formOpen = false;
    this.editingId = null;
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

    if (
      !f.patientName.trim() ||
      !/^\d{1,3}$/.test(f.age) ||
      !f.gender ||
      !/^\d{10}$/.test(f.phone)
    ) {
      this.formError = 'Enter name, age, gender and a 10-digit phone number';
      return;
    }

    this.saving = true;
    this.formError = '';

    // EDIT: PUT /api/reception/visits/:id  (receptionist route)
    if (this.editingId) {
      this.http
        .put<QueueItem>(
          `${API}/reception/visits/${this.editingId}`,
          {
            patientName: f.patientName.trim(),
            age: f.age,
            gender: f.gender,
            phone: f.phone,
            vitals: f.vitals,
          },
          { withCredentials: true },
        )
        .subscribe({
          next: (visit) => {
            this.saving = false;
            this.formOpen = false;
            this.editingId = null;
            this.message = `${visit.patientName} details updated`;
            this.load();
          },
          error: (err) => {
            this.saving = false;
            this.formError = err?.error?.message || 'Could not save the changes';
          },
        });
      return;
    }

    // NEW VISIT: POST /api/reception/visits  (receptionist route)
    this.api
      .addVisit({
        patientId: f.patientId || undefined,
        patientName: f.patientName.trim(),
        age: f.age,
        gender: f.gender,
        phone: f.phone,
        vitals: f.vitals,
      })
      .subscribe({
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
        next: (hits) => {
          this.hits = hits;
          this.searched = true;
        },
        error: () => {
          this.hits = [];
          this.searched = true;
        },
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