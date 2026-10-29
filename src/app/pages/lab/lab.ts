import { API_BASE } from '../../api';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { LabService } from '../../services/staff';
import { LabResult, Visit, isAbnormal, splitTests } from '../../services/visit';

const API = API_BASE;

type DoneVisit = Visit & { labReadyAt?: string };

// Same as the backend: after this many days without reports a patient leaves the lab list
const LAB_PENDING_DAYS = 10;

// Date on this computer as YYYY-MM-DD (what <input type="date"> uses)
const dayStr = (date: Date) => date.toLocaleDateString('en-CA');
const daysAgo = (n: number) => dayStr(new Date(Date.now() - n * 24 * 60 * 60 * 1000));

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
  templateUrl: './lab.html',
})
export class Lab implements OnInit, OnDestroy {
  tab: 'pending' | 'completed' = 'pending';
  cards: LabCard[] = [];
  completed: DoneVisit[] = [];
  loading = false;
  error = '';
  now = new Date();
  search = '';
  view: string | null = null;
  private timer?: ReturnType<typeof setInterval>;

  // From / To dates. Pending: when sent to the lab (default: the last 10 days).
  // Completed: when the reports were made ready (default: today).
  readonly today = dayStr(new Date());
  private range = {
    pending: { from: daysAgo(LAB_PENDING_DAYS - 1), to: this.today },
    completed: { from: this.today, to: this.today },
  };
  rangeError = '';

  get from(): string {
    return this.range[this.tab].from;
  }
  set from(value: string) {
    this.range[this.tab].from = value;
    this.rangeChanged();
  }
  get to(): string {
    return this.range[this.tab].to;
  }
  set to(value: string) {
    this.range[this.tab].to = value;
    this.rangeChanged();
  }

  private rangeChanged(): void {
    const { from, to } = this.range[this.tab];
    this.rangeError = from && to && to < from ? "'To' date must be after 'From' date" : '';
    if (!this.rangeError && this.tab === 'completed') this.loadCompleted();
  }

  // Back to the default dates of the open tab
  resetRange(): void {
    this.range.pending = { from: daysAgo(LAB_PENDING_DAYS - 1), to: this.today };
    this.range.completed = { from: this.today, to: this.today };
    this.rangeError = '';
    this.loadCompleted();
  }

  // Day the patient was sent to the lab (YYYY-MM-DD)
  private sentDay(v: Visit): string {
    return dayStr(new Date(v.labSentAt || v.updatedAt || v.visitDate || Date.now()));
  }

  private inRange(v: Visit): boolean {
    const { from, to } = this.range.pending;
    const day = this.sentDay(v);
    return (!from || day >= from) && (!to || day <= to);
  }

  constructor(
    private api: LabService,
    private auth: AuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  get name(): string {
    return this.auth.getUsername();
  }

  get searching(): boolean {
    return this.search.trim().length > 0;
  }

  private matches(v: Visit): boolean {
    const q = this.search.trim().toLowerCase();
    if (!q) return true;
    return [v.token, v.patientName, v.phone, v.patientId].some((x) =>
      String(x || '')
        .toLowerCase()
        .includes(q),
    );
  }

  get shownCards(): LabCard[] {
    return this.cards.filter((c) => this.matches(c.visit) && this.inRange(c.visit));
  }

  get shownCompleted(): DoneVisit[] {
    return this.completed.filter((v) => this.matches(v));
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
    const { from, to } = this.range.completed;
    if (from && to && to < from) return;
    this.http
      .get<DoneVisit[]>(`${API}/lab/completed`, {
        withCredentials: true,
        params: { from: from || this.today, to: to || from || this.today },
      })
      .subscribe({
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