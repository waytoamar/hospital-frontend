import { API_BASE } from '../../api';
import { Holidays } from '../holidays/holidays';
import { UpcomingBookings } from '../upcoming-bookings/upcoming-bookings';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { DeskVitals, PatientHit, QueueItem, ReceptionService } from '../../services/staff';
import { SpeechService } from '../../services/speech.service';
import { HttpClient } from '@angular/common/http';

const API = API_BASE;

interface FollowUpHit {
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  followUpDate: string;
}

type BoardView = 'waiting' | 'consult' | 'done' | 'lab' | 'followup';
const BOARD_VIEWS: BoardView[] = ['waiting', 'consult', 'done', 'lab', 'followup'];

interface Money {
  count: number;
  amount: number;
}

interface Summary {
  date: string;
  patients: number;
  notBilled: number;
  split: number;
  cash: Money;
  upi: Money;
  total: Money;
  services: Record<string, Money>;
}

interface Column {
  label: string;
  tone: 'waiting' | 'consult' | 'lab' | 'done';
  items: QueueItem[];
}

type FeeKey = 'consultation' | 'rbs' | 'ecg' | 'xray' | 'daycare';
type Fees = Record<FeeKey, string>;

const emptyFees = (): Fees => ({ consultation: '', rbs: '', ecg: '', xray: '', daycare: '' });

interface VisitForm {
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  vitals: DeskVitals;
  fees: Fees;
  payCash: boolean;
  payUpi: boolean;
  cashPart: string; // used only when both Cash and UPI are selected
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
  fees: emptyFees(),
  payCash: false,
  payUpi: false,
  cashPart: '',
});

@Component({
  selector: 'app-reception',
  standalone: true,
  imports: [CommonModule, FormsModule, Holidays, UpcomingBookings],
  styleUrls: ['../staff-shared.css', './reception.css'],
  templateUrl: './reception.html',
})
export class Reception implements OnInit, OnDestroy {
  tab: 'board' | 'patients' = 'board';
  // Which board sections are closed. Remembered on this computer / phone.
  private closed: Record<string, boolean> = Reception.loadClosed();
  // Which count box is chosen (shown as cards below). Remembered on this computer / phone.
  view: BoardView = Reception.loadView();
  groupSearch = '';
  columns: Column[] = [];
  followUps: FollowUpHit[] = [];
  todayStr = '';
  private boardSig = '';
  private summarySig = '';
  summary: Summary | null = null;
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
  pickedName = '';
  matches: PatientHit[] = [];
  saving = false;

  search = '';
  hits: PatientHit[] = [];
  searched = false;
  phoneEdit: { id: string; value: string } | null = null;
  phoneError = '';

  readonly feeItems: { key: FeeKey; label: string }[] = [
    { key: 'consultation', label: 'Consultation fee' },
    { key: 'rbs', label: 'RBS' },
    { key: 'ecg', label: 'ECG' },
    { key: 'xray', label: 'X-ray' },
    { key: 'daycare', label: 'Daycare' },
  ];

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

  private static readonly CLOSED_KEY = 'reception-closed-sections';
  private static readonly VIEW_KEY = 'reception-board-view';

  private static loadView(): BoardView {
    try {
      const v = localStorage.getItem(Reception.VIEW_KEY) as BoardView | null;
      return v && BOARD_VIEWS.includes(v) ? v : 'waiting';
    } catch {
      return 'waiting';
    }
  }

  // The five count boxes on top of the board
  get groups(): { key: BoardView; label: string; count: number }[] {
    return [
      { key: 'waiting', label: 'Waiting', count: this.itemsFor('waiting').length },
      { key: 'consult', label: 'With doctor', count: this.itemsFor('consult').length },
      { key: 'done', label: 'Completed', count: this.itemsFor('done').length },
      { key: 'lab', label: 'At lab', count: this.atLab.length },
      { key: 'followup', label: 'Follow-ups', count: this.followUps.length },
    ];
  }

  get current(): { key: BoardView; label: string; count: number } {
    return this.groups.find((g) => g.key === this.view) || this.groups[0];
  }

  private itemsFor(key: BoardView): QueueItem[] {
    if (key === 'lab') return this.atLab;
    return this.columns.find((c) => c.tone === key)?.items || [];
  }

  private matchesSearch(...fields: (string | undefined)[]): boolean {
    const q = this.groupSearch.trim().toLowerCase();
    return !q || fields.some((f) => String(f || '').toLowerCase().includes(q));
  }

  get visibleQueue(): QueueItem[] {
    return this.itemsFor(this.view).filter((v) => this.matchesSearch(v.patientName, v.token, v.phone));
  }

  get visibleFollowUps(): FollowUpHit[] {
    return this.followUps.filter((f) => this.matchesSearch(f.patientName, f.patientId, f.phone));
  }

  get shownCount(): number {
    return this.view === 'followup' ? this.visibleFollowUps.length : this.visibleQueue.length;
  }

  // ---- Pages for Completed and Follow-ups ----
  page = 1;
  private screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1366;

  @HostListener('window:resize')
  onResize(): void {
    this.screenWidth = window.innerWidth;
  }

  // Every box gets pages when it has more patients than fit in 2 rows
  private get paged(): boolean {
    return true;
  }

  // Laptop: 2 rows of 4 = 8. Tablet: 2 rows of 3 = 6. Phone: 3 rows of 2 = 6.
  get pageSize(): number {
    if (!this.paged) return Number.MAX_SAFE_INTEGER;
    return this.screenWidth > 1100 ? 8 : 6;
  }

  get pageCount(): number {
    return this.paged ? Math.max(1, Math.ceil(this.shownCount / this.pageSize)) : 1;
  }

  get pageStart(): number {
    return (Math.min(this.page, this.pageCount) - 1) * this.pageSize;
  }

  get pagedQueue(): QueueItem[] {
    return this.visibleQueue.slice(this.pageStart, this.pageStart + this.pageSize);
  }

  get pagedFollowUps(): FollowUpHit[] {
    return this.visibleFollowUps.slice(this.pageStart, this.pageStart + this.pageSize);
  }

  get pageItemsCount(): number {
    return this.view === 'followup' ? this.pagedFollowUps.length : this.pagedQueue.length;
  }

  // 1 2 3 4 5, or 1 … 4 5 6 … 12 when there are many pages (0 = "…")
  get pageNumbers(): number[] {
    const total = this.pageCount;
    const cur = Math.min(this.page, total);
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const nums = new Set([1, total, cur - 1, cur, cur + 1]);
    const list = [...nums].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    const out: number[] = [];
    list.forEach((n, i) => {
      if (i && n - list[i - 1] > 1) out.push(0);
      out.push(n);
    });
    return out;
  }

  // Phones with many pages: "‹ Page 2 of 7 ›" instead of 7 number buttons
  get compactPager(): boolean {
    return this.screenWidth <= 760 && this.pageCount > 5;
  }

  goPage(n: number): void {
    this.page = Math.max(1, Math.min(n, this.pageCount));
  }

  // Click a count box: show that group below
  pick(key: BoardView): void {
    this.view = key;
    this.page = 1;
    this.groupSearch = '';
    try {
      localStorage.setItem(Reception.VIEW_KEY, key);
    } catch {
      // not remembered in a private window - still works
    }
  }

  private static loadClosed(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(Reception.CLOSED_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  isClosed(section: string): boolean {
    return !!this.closed[section];
  }

  // Click a section heading: close it, click again: open it
  toggle(section: string): void {
    this.closed = { ...this.closed, [section]: !this.closed[section] };
    try {
      localStorage.setItem(Reception.CLOSED_KEY, JSON.stringify(this.closed));
    } catch {
      // private window etc. - it still works, just isn't remembered
    }
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

  get billTotal(): number {
    return this.feeItems.reduce((sum, item) => sum + (Number(this.form.fees[item.key]) || 0), 0);
  }

  // Only Cash: all of it. Both: what the patient handed over in cash. Only UPI: none.
  get cashAmount(): number {
    const total = this.billTotal;
    if (!total || !this.form.payCash) return 0;
    if (!this.form.payUpi) return total;
    return Math.min(Math.max(Number(this.form.cashPart) || 0, 0), total);
  }

  // Whatever is left after the cash goes to UPI
  get upiAmount(): number {
    const total = this.billTotal;
    if (!total || !this.form.payUpi) return 0;
    return total - this.cashAmount;
  }

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

  private loadSummary(): void {
    this.http.get<Summary>(`${API}/reception/summary`, { withCredentials: true }).subscribe({
      next: (r) => (this.summary = r),
      error: () => {},
    });
  }

  private loadFollowUps(): void {
    this.http
      .get<{ today: string; list: FollowUpHit[] }>(`${API}/reception/followups`, {
        withCredentials: true,
      })
      .subscribe({
        next: (r) => {
          this.todayStr = r.today;
          this.followUps = r.list;
        },
        error: () => {},
      });
  }

  // One click: opens the new-visit form with the old patient's details filled in
  addFollowUp(f: FollowUpHit): void {
    this.openForm({ ...f, lastVisit: '' } as unknown as PatientHit);
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
          // newest first: the patient who just finished is on page 1
          { label: 'Completed', tone: 'done', items: by('Completed').reverse() },
        ];
        this.atLab = by('Lab investigation');
        // Reload the follow-up list only when the queue changed (new visit, no show...)
        const sig = visits.map((v) => v._id + v.status).join('|');
        if (sig !== this.boardSig) {
          this.boardSig = sig;
          this.loadFollowUps();
        }
        // Reload today's collection when the queue or any bill changed
        const billSig =
          sig +
          '|' +
          visits.map((v) => (v as QueueItem & { billTotal?: number }).billTotal || 0).join(',');
        if (billSig !== this.summarySig) {
          this.summarySig = billSig;
          this.loadSummary();
        }
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

  // WhatsApp patient booked earlier and has now reached the clinic (tap again to undo)
  markArrived(v: QueueItem): void {
    if (!v._id || this.busyId) return;
    const arrived = !v.arrivedAt;
    this.busyId = v._id;
    this.api.markArrived(v._id, arrived).subscribe({
      next: () => {
        this.busyId = null;
        this.message = arrived ? `${v.patientName} (${v.token}) has arrived.` : `${v.patientName}: arrival undone.`;
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
    const bill = v as QueueItem & {
      fees?: Partial<Record<FeeKey, number>>;
      paymentMode?: string;
      cashAmount?: number;
      upiAmount?: number;
    };
    const fees = emptyFees();
    this.feeItems.forEach((item) => {
      const amount = bill.fees?.[item.key];
      fees[item.key] = amount ? String(amount) : '';
    });
    const paid = this.feeItems.reduce((sum, item) => sum + (bill.fees?.[item.key] || 0), 0);
    let cash = bill.cashAmount || 0;
    let upi = bill.upiAmount || 0;
    if (!cash && !upi) {
      if (bill.paymentMode === 'Cash') cash = paid;
      if (bill.paymentMode === 'UPI') upi = paid;
    }
    this.form = {
      patientId: v.patientId || '',
      patientName: v.patientName || '',
      age: String(v.age || ''),
      gender: v.gender || '',
      phone: v.phone || '',
      vitals: { ...emptyVitals(), ...vit } as DeskVitals,
      fees,
      payCash: cash > 0,
      payUpi: upi > 0,
      cashPart: cash > 0 && upi > 0 ? String(cash) : '',
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
    this.pickedName = p.patientName;
    this.matches = [];
  }

  // Same phone, different family member: keep the phone, clear the rest, new ID
  newOnSamePhone(): void {
    this.form.patientId = '';
    this.form.patientName = '';
    this.form.age = '';
    this.form.gender = '';
    this.pickedName = '';
    this.matches = [];
    this.lookupMsg = 'New patient on this number. Fill in the details below.';
  }

  // Name changed after picking an old patient: this is a different person, drop the old ID
  onNameTyped(): void {
    if (
      this.form.patientId &&
      this.form.patientName.trim().toLowerCase() !== this.pickedName.trim().toLowerCase()
    ) {
      this.form.patientId = '';
      this.pickedName = '';
      this.lookupMsg = 'Name changed, so this will be saved as a new patient.';
    }
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
        if (exact.length) {
          // Always let the receptionist choose: the number may belong to a family
          this.matches = exact;
          this.lookupMsg =
            exact.length === 1
              ? 'Found 1 patient on this number. Tap the name, or add a new patient:'
              : `Found ${exact.length} patients on this number. Pick one, or add a new patient:`;
        } else {
          this.matches = [];
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

    const badFee = this.feeItems.find((item) => !/^\d{0,7}$/.test(String(f.fees[item.key]).trim()));
    if (badFee) {
      this.formError = `${badFee.label}: enter the amount in numbers only`;
      return;
    }
    if (this.billTotal > 0) {
      if (!f.payCash && !f.payUpi) {
        this.formError = 'Choose Cash or UPI (or both) for the amount entered';
        return;
      }
      if (f.payCash && f.payUpi && (this.cashAmount <= 0 || this.cashAmount >= this.billTotal)) {
        this.formError =
          'Split payment: enter the cash given. It must be less than the total, the rest goes to UPI';
        return;
      }
    }

    const billing = {
      fees: Object.fromEntries(
        this.feeItems.map((item) => [item.key, Number(f.fees[item.key]) || 0]),
      ),
      payment: { cash: this.cashAmount, upi: this.upiAmount },
    };

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
            ...billing,
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
    this.http
      .post<QueueItem>(
        `${API}/reception/visits`,
        {
          patientId: f.patientId || undefined,
          patientName: f.patientName.trim(),
          age: f.age,
          gender: f.gender,
          phone: f.phone,
          vitals: f.vitals,
          ...billing,
        },
        { withCredentials: true },
      )
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