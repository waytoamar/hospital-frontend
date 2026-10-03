import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { LabService } from '../../services/staff';
import { LabResult, Visit, isAbnormal, splitTests } from '../../services/visit';

const API = 'https://hospital-backend-yxe9.onrender.com/api';

type DoneVisit = Visit & { labReadyAt?: string };

interface LabCard {
  visit: Visit;
  results: LabResult[];
  dirty: boolean;
  busy: boolean;
  message: string;
}

@Component({
  selector: 'app-lab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './lab.css',
  template: `
    <header class="topbar">
      <div class="brand">
        <img class="logo-img" src="lungs.jpg" alt="" />
        <div><b>Chest &amp; Allergy Clinic</b><small>Lab Desk</small></div>
      </div>
      <div class="who">
        <b>{{ name }}</b>
        <button class="logout" (click)="logout()">Logout ⇥</button>
      </div>
    </header>

    <main class="page">
      <div class="head">
        <div>
          <p class="date">{{ now | date: 'EEEE, d MMMM' }}</p>
          <h1>
            Lab Investigations <span class="count">{{ cards.length }}</span>
          </h1>
          <p class="lead">
            Patients sent by the doctor for tests. Enter results, add report photos, then press
            "Reports ready".
          </p>
        </div>
      </div>

      <div class="tabs">
        <button [class.active]="tab === 'pending'" (click)="tab = 'pending'">
          Pending <span class="n">{{ cards.length }}</span>
        </button>
        <button [class.active]="tab === 'completed'" (click)="tab = 'completed'">
          Completed <span class="n">{{ completed.length }}</span>
        </button>
      </div>

      <p class="error" *ngIf="error">{{ error }}</p>

      <!-- COMPLETED -->
      <ng-container *ngIf="tab === 'completed'">
        <p class="empty" *ngIf="!completed.length">No completed reports yet today</p>

        <section class="card done" *ngFor="let v of completed; trackBy: trackDone">
          <div class="card-head">
            <span class="tok">{{ v.token || '—' }}</span>
            <div class="who-pt">
              <b>{{ v.patientName }}</b>
              <small>{{ v.age }} · {{ v.gender }} · {{ v.phone }}</small>
            </div>
            <span class="since ok"
              >✓ Reports ready{{
                v.labReadyAt ? ' · ' + (v.labReadyAt | date: 'shortTime') : ''
              }}</span
            >
          </div>

          <p class="ordered"><b>Doctor ordered:</b> {{ v.labInvestigations || '—' }}</p>

          <div class="res" *ngIf="v.labResults?.length">
            <div class="r-head">
              <span>Test</span><span>Result</span><span>Normal range</span><span>Status</span>
            </div>
            <div class="r-row" *ngFor="let r of v.labResults">
              <span>{{ r.name }}</span>
              <span [class.bad]="abnormal(r)">{{ r.result || '—' }}</span>
              <span>{{ r.range || '—' }}</span>
              <span class="st" [class.ok]="r.done">{{ r.done ? '✓ Done' : '… Pending' }}</span>
            </div>
          </div>

          <div class="photos" *ngIf="v.labPhotos?.length">
            <div class="ph" *ngFor="let p of v.labPhotos">
              <img [src]="p.data" alt="Report photo" (click)="view = p.data" />
            </div>
          </div>
        </section>
      </ng-container>

      <!-- PENDING -->
      <p class="empty" *ngIf="tab === 'pending' && !cards.length && !loading">
        No patients waiting for tests 🎉
      </p>

      <ng-container *ngIf="tab === 'pending'">
        <section class="card" *ngFor="let c of cards; trackBy: trackById">
          <div class="card-head">
            <span class="tok">{{ c.visit.token || '—' }}</span>
            <div class="who-pt">
              <b>{{ c.visit.patientName }}</b>
              <small>{{ c.visit.age }} · {{ c.visit.gender }} · {{ c.visit.phone }}</small>
            </div>
            <span class="since" [class.late]="minutes(c.visit) >= 45"
              >⏱ Sent to lab {{ ago(c.visit) }}</span
            >
          </div>

          <p class="ordered"><b>Doctor ordered:</b> {{ c.visit.labInvestigations || '—' }}</p>

          <div class="tests">
            <div class="t-head">
              <span>Test</span><span>Result</span><span>Normal range</span><span>Status</span
              ><span></span>
            </div>
            <div class="t-row" *ngFor="let r of c.results; let i = index">
              <input [(ngModel)]="r.name" (ngModelChange)="touch(c)" placeholder="Test name" />
              <input
                [(ngModel)]="r.result"
                (ngModelChange)="touch(c)"
                placeholder="Result"
                [class.bad]="abnormal(r)"
              />
              <input [(ngModel)]="r.range" (ngModelChange)="touch(c)" placeholder="e.g. 4-11" />
              <button class="chip" [class.done]="r.done" (click)="r.done = !r.done; touch(c)">
                {{ r.done ? '✓ Done' : '… Pending' }}
              </button>
              <button class="x" (click)="c.results.splice(i, 1); touch(c)" aria-label="Remove test">
                ✕
              </button>
            </div>
            <button
              class="add"
              (click)="c.results.push({ name: '', result: '', range: '', done: false }); touch(c)"
            >
              ＋ Add test
            </button>
          </div>

          <div class="photos">
            <div class="ph" *ngFor="let p of c.visit.labPhotos || []">
              <img [src]="p.data" alt="Report photo" (click)="view = p.data" />
              <button class="x" (click)="deletePhoto(c, p._id)" aria-label="Delete photo">✕</button>
            </div>
            <label class="ph add-ph" *ngIf="(c.visit.labPhotos?.length || 0) < 8">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                hidden
                (change)="addPhotos(c, $event)"
              />
              <span>📷<br />Add report photo</span>
            </label>
          </div>

          <footer>
            <span class="msg" [class.err]="c.message.startsWith('⚠')">{{ c.message }}</span>
            <span class="progress">{{ doneCount(c) }}/{{ c.results.length }} done</span>
            <button class="ghost" [disabled]="c.busy" (click)="save(c)">Save</button>
            <button class="go" [disabled]="c.busy" (click)="ready(c)">✓ Reports ready</button>
          </footer>
        </section>
      </ng-container>
    </main>

    <div class="viewer" *ngIf="view" (click)="view = null">
      <img [src]="view" alt="Report photo" />
    </div>
  `,
})
export class Lab implements OnInit, OnDestroy {
  tab: 'pending' | 'completed' = 'pending';
  cards: LabCard[] = [];
  completed: DoneVisit[] = [];
  loading = false;
  error = '';
  now = new Date();
  view: string | null = null;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private api: LabService,
    private auth: AuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  get name(): string {
    return this.auth.getUsername();
  }

  ngOnInit(): void {
    this.refresh();
    this.timer = setInterval(() => {
      this.now = new Date();
      if (!this.view) this.refresh();
    }, 10000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  trackById = (_: number, c: LabCard) => c.visit._id;
  trackDone = (_: number, v: DoneVisit) => v._id;
  abnormal = (r: LabResult) => isAbnormal(r.result, r.range);
  doneCount = (c: LabCard) => c.results.filter((r) => r.done).length;
  touch(c: LabCard): void {
    c.dirty = true;
    c.message = '';
  }

  minutes(v: Visit): number {
    const from = new Date(v.labSentAt || v.updatedAt || v.visitDate || Date.now()).getTime();
    return Math.max(0, Math.round((this.now.getTime() - from) / 60000));
  }

  ago(v: Visit): string {
    const m = this.minutes(v);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    return `${Math.floor(m / 60)} h ${m % 60} min ago`;
  }

  private startResults(v: Visit): LabResult[] {
    if (v.labResults?.length) return v.labResults.map((r) => ({ ...r }));
    return splitTests(v.labInvestigations).map((name) => ({
      name,
      result: '',
      range: '',
      done: false,
    }));
  }

  private loadCompleted(): void {
    this.http.get<DoneVisit[]>(`${API}/lab/completed`, { withCredentials: true }).subscribe({
      next: (list) => (this.completed = list),
      error: (err) => {
        if (err.status === 401 || err.status === 403) this.router.navigate(['/welcome']);
      },
    });
  }

  private refresh(): void {
    this.loadCompleted();
    this.loading = true;
    this.api.queue().subscribe({
      next: (list) => {
        this.loading = false;
        this.error = '';
        const old = new Map(this.cards.map((c) => [c.visit._id, c]));
        this.cards = list.map((v) => {
          const kept = old.get(v._id);
          if (kept && (kept.dirty || kept.busy)) {
            kept.visit = v; // keep typed-but-unsaved results
            return kept;
          }
          return {
            visit: v,
            results: this.startResults(v),
            dirty: false,
            busy: false,
            message: kept?.message || '',
          };
        });
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/welcome']);
          return;
        }
        this.error = 'Could not load lab list. Retrying…';
      },
    });
  }

  private clean(c: LabCard): LabResult[] {
    return c.results.filter((r) => r.name.trim());
  }

  save(c: LabCard): void {
    c.busy = true;
    this.api.saveResults(c.visit._id!, this.clean(c)).subscribe({
      next: (v) => {
        c.visit = v;
        c.results = this.startResults(v);
        c.busy = false;
        c.dirty = false;
        c.message = 'Saved ✓';
      },
      error: (err) => this.fail(c, err),
    });
  }

  ready(c: LabCard): void {
    const pending = c.results.filter((r) => r.name.trim() && !r.done).length;
    if (
      pending &&
      !confirm(`${pending} test(s) are still pending. Send back to the doctor anyway?`)
    )
      return;
    c.busy = true;
    this.api.ready(c.visit._id!, this.clean(c)).subscribe({
      next: () => {
        this.cards = this.cards.filter((x) => x !== c);
        this.loadCompleted();
      },
      error: (err) => this.fail(c, err),
    });
  }

  async addPhotos(c: LabCard, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    for (const file of files) {
      c.busy = true;
      c.message = 'Uploading photo…';
      try {
        const data = await this.compress(file);
        const v = await new Promise<Visit>((resolve, reject) =>
          this.api.addPhoto(c.visit._id!, data).subscribe({ next: resolve, error: reject }),
        );
        c.visit = { ...c.visit, labPhotos: v.labPhotos };
        c.message = 'Photo added ✓';
      } catch (err: any) {
        this.fail(c, err);
        break;
      }
      c.busy = false;
    }
  }

  deletePhoto(c: LabCard, photoId: string): void {
    if (!confirm('Delete this photo?')) return;
    c.busy = true;
    this.api.deletePhoto(c.visit._id!, photoId).subscribe({
      next: (v) => {
        c.visit = { ...c.visit, labPhotos: v.labPhotos };
        c.busy = false;
      },
      error: (err) => this.fail(c, err),
    });
  }

  // Shrinks phone photos (~4 MB) to a readable JPEG (~200-400 KB)
  private compress(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject({ error: { message: 'This file is not a photo' } });
      };
      img.src = url;
    });
  }

  private fail(c: LabCard, err: any): void {
    c.busy = false;
    if (err?.status === 401 || err?.status === 403) {
      this.router.navigate(['/welcome']);
      return;
    }
    c.message = '⚠ ' + (err?.error?.message || 'Something went wrong. Please try again.');
    if (err?.status === 404) this.refresh();
  }

  logout(): void {
    const leave = () => this.router.navigate(['/welcome']);
    this.auth.logout().subscribe({ next: leave, error: leave });
  }
}
