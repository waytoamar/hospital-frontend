import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../services/auth';
import { Medicine, Visit, VisitService, VisitStatus } from '../../services/visit';
import {
  isPreprintedPaper,
  prescriptionPdfBase64,
  printPrescription,
  setPreprintedPaper,
} from '../../services/prescription-print';
import {
  BoardFilter,
  DashboardView,
  PanelKey,
  PastValueField,
  VisitFormRequest,
} from './dashboard.models';
import { patientKey, uniqueValues, visitTime } from './visit-format';

const PULSE_EVERY_MS = 10_000;
const CLOCK_EVERY_MS = 30_000;
const NOTICE_MS = 6_000;

/**
 * State and actions of the doctor dashboard, shared by all its parts
 * (board, queue, patients, records, visit form, patient history).
 * Provided by the Dashboard page, so it lives only while the doctor is on that page.
 */
@Injectable()
export class DashboardStore implements OnDestroy {
  // ---- Data ----
  visits: Visit[] = [];
  now = new Date();

  /** Fires when the server reports a change (other parts reload their own data). */
  readonly serverChanged$ = new Subject<void>();

  // ---- Screen state ----
  activeView: DashboardView = 'board';
  searchTerm = '';
  boardFilter: BoardFilter = 'all';
  selectedPatientKey = '';
  selectedQueueVisit: Visit | null = null;
  selectedQueuePanel: PanelKey = 'waiting';
  queueBusy = false;
  formRequest: VisitFormRequest | null = null;

  // ---- Printing, backup, WhatsApp ----
  preprintedPaper = isPreprintedPaper();
  backupBusy = false;
  whatsappReady = false;
  notice = '';
  noticeIsError = false;

  private syncedAt: string | null = null; // newest "updatedAt" already loaded
  private syncing = false;
  private lastPulse = '';
  private timers: ReturnType<typeof setInterval>[] = [];
  private noticeTimer?: ReturnType<typeof setTimeout>;

  private tokenSource: Visit[] | null = null;
  private tokenMap = new Map<string, string>();
  private pastValueSource: Visit[] | null = null;
  private pastValueCache = new Map<PastValueField, string[]>();

  constructor(
    private auth: AuthService,
    private visitService: VisitService,
    private router: Router,
  ) {}

  start(): void {
    this.loadVisits();
    this.visitService.whatsappFeatures().subscribe({
      next: (features) => (this.whatsappReady = !!features.prescription),
      error: () => (this.whatsappReady = false), // WhatsApp not set up
    });
    this.timers.push(setInterval(() => this.checkForChanges(), PULSE_EVERY_MS));
    this.timers.push(setInterval(() => (this.now = new Date()), CLOCK_EVERY_MS));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearInterval);
    clearTimeout(this.noticeTimer);
  }

  // ===== Signed-in doctor =====

  get username(): string {
    return this.auth.getUsername();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  openStaff(): void {
    this.router.navigate(['/staff']);
  }

  // ===== Lists =====

  get todayVisits(): Visit[] {
    const today = new Date().toDateString();
    return this.visits.filter(
      (visit) => visit.visitDate && new Date(visit.visitDate).toDateString() === today,
    );
  }

  get boardWaiting(): Visit[] {
    return this.todayWith('Waiting').sort((a, b) => visitTime(a) - visitTime(b));
  }

  get boardConsulting(): Visit[] {
    return this.todayWith('In consultation').sort((a, b) => visitTime(a) - visitTime(b));
  }

  /** Patients at the lab stay on the board even when they were sent on an earlier day. */
  get boardLab(): Visit[] {
    return this.visits
      .filter((visit) => visit.status === 'Lab investigation' && this.matchesSearch(visit))
      .sort((a, b) => visitTime(a) - visitTime(b));
  }

  get boardCompleted(): Visit[] {
    return this.todayWith('Completed').sort((a, b) => visitTime(b) - visitTime(a));
  }

  /**
   * Follow-ups due in the next 7 days. A follow-up counts only while it belongs to the
   * patient's latest visit: once the patient has come back, it leaves the list.
   */
  get boardFollowUps(): Visit[] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    const latest = new Map<string, number>();
    for (const visit of this.visits) {
      const key = patientKey(visit);
      latest.set(key, Math.max(latest.get(key) ?? 0, visitTime(visit)));
    }

    return this.visits
      .filter((visit) => {
        if (!visit.followUpDate || visitTime(visit) < (latest.get(patientKey(visit)) ?? 0)) {
          return false;
        }
        const due = new Date(`${visit.followUpDate}T00:00:00`);
        return due >= start && due <= end && this.matchesSearch(visit);
      })
      .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!));
  }

  /** One row per patient (their newest visit), filtered by the search box. */
  get patients(): Visit[] {
    const byPatient = new Map<string, Visit>();
    for (const visit of this.visits) {
      const key = patientKey(visit);
      if (this.matchesSearch(visit) && !byPatient.has(key)) {
        byPatient.set(key, visit);
      }
    }
    return [...byPatient.values()];
  }

  get selectedPatientVisits(): Visit[] {
    return this.visits.filter((visit) => patientKey(visit) === this.selectedPatientKey);
  }

  matchesSearch(visit: Visit): boolean {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [
      visit.patientName,
      visit.phone,
      visit.patientId,
      visit.disease,
      visit.diagnosis,
      this.tokenOf(visit),
    ].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(query),
    );
  }

  private todayWith(status: VisitStatus): Visit[] {
    return this.todayVisits.filter((visit) => visit.status === status && this.matchesSearch(visit));
  }

  // ===== Tokens and row text =====

  /** Today's token ("A-001") in order of arrival. */
  tokenOf(visit?: Visit): string {
    if (!visit?._id) {
      return '';
    }
    if (this.tokenSource !== this.visits) {
      this.tokenSource = this.visits;
      this.tokenMap = new Map();
      [...this.todayVisits]
        .sort((a, b) => visitTime(a) - visitTime(b))
        .forEach((item, index) => {
          if (item._id) {
            this.tokenMap.set(item._id, `A-${String(index + 1).padStart(3, '0')}`);
          }
        });
    }
    return this.tokenMap.get(visit._id) || '';
  }

  /** Grey line under the patient name on the board. */
  rowMeta(panel: PanelKey, visit: Visit): string {
    const token = this.tokenOf(visit);
    const time = visit.visitDate
      ? new Date(visit.visitDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '';
    const issue = visit.disease || visit.diagnosis || visit.symptoms || 'General';

    switch (panel) {
      case 'waiting':
        return this.join(token, time, issue, this.waitedFor(visit));
      case 'followup': {
        const due = visit.followUpDate
          ? new Date(`${visit.followUpDate}T00:00:00`).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
            })
          : '';
        return this.join(token, due && `Due ${due}`, visit.diagnosis || issue);
      }
      case 'lab':
        return this.join(token, visit.labInvestigations || 'Tests ordered');
      case 'done':
        return this.join(token, time, visit.diagnosis || issue);
      default:
        return this.join(token, time, issue);
    }
  }

  private waitedFor(visit: Visit): string {
    const minutes = Math.max(0, Math.round((this.now.getTime() - visitTime(visit)) / 60000));
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  private join(...parts: string[]): string {
    return parts.filter(Boolean).join(' · ');
  }

  // ===== Queue (Now calling) =====

  get nowCalling(): string {
    const current =
      this.selectedQueueVisit ||
      this.todayVisits
        .filter((visit) => visit.status === 'In consultation')
        .sort((a, b) => visitTime(b) - visitTime(a))[0];
    return this.tokenOf(current) || '—';
  }

  get upNextVisits(): Visit[] {
    const selectedId = this.selectedQueueVisit?._id;
    return this.boardWaiting.filter((visit) => visit._id !== selectedId).slice(0, 4);
  }

  selectQueue(visit: Visit, panel: PanelKey): void {
    this.selectedQueueVisit = visit;
    this.selectedQueuePanel = panel;
  }

  closeQueue(): void {
    this.selectedQueueVisit = null;
  }

  /** Big button of the queue card: call / complete / resume after lab / start follow-up. */
  advanceQueue(): void {
    const visit = this.selectedQueueVisit;
    if (!visit?._id || this.queueBusy) {
      return;
    }
    if (this.selectedQueuePanel === 'followup') {
      this.openNewVisit(visit);
      return;
    }

    const nextStatus: VisitStatus = visit.status === 'In consultation' ? 'Completed' : 'In consultation';
    const fromLab = visit.status === 'Lab investigation';

    this.queueBusy = true;
    this.visitService.updateStatus(visit._id, nextStatus).subscribe({
      next: (updated) => {
        visit.status = updated.status;
        this.queueBusy = false;

        if (nextStatus === 'Completed') {
          this.selectedQueuePanel = 'done';
          this.sendPrescriptionOnWhatsApp(updated);
        } else if (fromLab) {
          // Reports are back: open the visit so the doctor can see them and write medicines
          this.selectedQueuePanel = 'consult';
          this.editVisit(visit);
        } else if (this.upNextVisits[0]) {
          this.selectQueue(this.upNextVisits[0], 'waiting');
        } else {
          this.selectedQueuePanel = 'consult';
        }
      },
      error: () => {
        this.queueBusy = false;
        alert('Patient queue could not be updated.');
      },
    });
  }

  // ===== Navigation inside the dashboard =====

  showView(view: DashboardView): void {
    this.activeView = view;
    this.selectedPatientKey = '';
  }

  openPatient(visit: Visit): void {
    this.selectedPatientKey = patientKey(visit);
  }

  closePatient(): void {
    this.selectedPatientKey = '';
  }

  // ===== Visit form =====

  openNewVisit(patient?: Visit): void {
    this.formRequest = { mode: 'new', visit: patient };
  }

  editVisit(visit: Visit): void {
    this.formRequest = { mode: 'edit', visit };
  }

  closeForm(): void {
    this.formRequest = null;
  }

  /** After the form saved a visit: refresh the lists, send the prescription if completed. */
  visitSaved(saved: Visit): void {
    this.formRequest = null;
    this.refreshVisits();
    if (saved.status === 'Completed') {
      this.sendPrescriptionOnWhatsApp(saved);
    }
  }

  /** Earlier values of a field, newest first (used for suggestions in the form). */
  pastValues(field: PastValueField): string[] {
    if (this.pastValueSource !== this.visits) {
      this.pastValueSource = this.visits;
      this.pastValueCache.clear();
    }
    let values = this.pastValueCache.get(field);
    if (!values) {
      values = uniqueValues(this.visits.flatMap((visit) => this.readField(visit, field)));
      this.pastValueCache.set(field, values);
    }
    return values;
  }

  private readField(visit: Visit, field: PastValueField): Array<string | undefined> {
    switch (field) {
      case 'cvs':
      case 'rs':
      case 'cns':
      case 'gi':
        return [visit.examination?.[field]];
      case 'drugAllergyDetails':
      case 'surgicalComplicationsNote':
        return [visit.comorbidities?.[field]];
      case 'medicineName':
        return (visit.medicines || []).map((medicine) => medicine.name);
      case 'medicineDuration':
        return (visit.medicines || []).map((medicine) => medicine.duration);
      default:
        return [visit[field]];
    }
  }

  /** The last time this medicine was prescribed (visits are newest first). */
  lastPrescription(name: string): Medicine | undefined {
    const wanted = name.trim().toLowerCase();
    for (const visit of this.visits) {
      const found = (visit.medicines || []).find((item) => item.name.trim().toLowerCase() === wanted);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  /** A patient seen before, found by phone number or patient ID. */
  findPatient(phone: string, patientId: string): Visit | undefined {
    const id = patientId.trim().toLowerCase();
    const number = phone.trim();
    return this.visits.find(
      (visit) => (number && visit.phone === number) || (id && visit.patientId?.toLowerCase() === id),
    );
  }

  /** The patient's last visit that has notes (to start a new visit from it). */
  lastFilledVisit(patient: Visit, excludeId?: string): Visit | undefined {
    const key = patientKey(patient);
    return this.visits.find(
      (visit) =>
        visit._id !== excludeId &&
        patientKey(visit) === key &&
        !!(visit.disease || visit.diagnosis || visit.medicines?.length),
    );
  }

  // ===== Visit actions =====

  setStatus(visit: Visit, status: VisitStatus): void {
    if (!visit._id) {
      return;
    }
    this.visitService.updateStatus(visit._id, status).subscribe({
      next: (updated) => {
        visit.status = updated.status;
        if (this.selectedQueueVisit?._id === visit._id) {
          this.selectedQueueVisit = visit;
        }
        if (status === 'Completed') {
          this.sendPrescriptionOnWhatsApp(updated);
        }
      },
      error: () => alert('Status could not be updated.'),
    });
  }

  deleteVisit(visit: Visit): void {
    const id = visit._id;
    if (!id || !confirm('Delete this visit permanently?')) {
      return;
    }
    this.visitService.deleteVisit(id).subscribe({
      next: () => {
        this.applyVisits(this.visits.filter((item) => item._id !== id));
        this.refreshVisits();
      },
      error: () => alert('Visit could not be deleted.'),
    });
  }

  print(visit: Visit): void {
    printPrescription(visit);
  }

  setPreprintedPaper(on: boolean): void {
    this.preprintedPaper = on;
    setPreprintedPaper(on);
  }

  /** Downloads all clinic data as one file (it has patient details: keep it safe). */
  downloadBackup(): void {
    if (this.backupBusy) {
      return;
    }
    this.backupBusy = true;
    this.visitService.downloadBackup().subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `clinic-backup-${new Date().toLocaleDateString('en-CA')}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
        this.backupBusy = false;
      },
      error: () => {
        this.backupBusy = false;
        alert('Backup could not be downloaded. Please try again.');
      },
    });
  }

  // ===== WhatsApp =====

  /**
   * After "Complete": makes the prescription PDF and the backend sends it on WhatsApp.
   * Only when medicines were written, so an empty prescription is never sent.
   */
  private async sendPrescriptionOnWhatsApp(visit: Visit): Promise<void> {
    if (!this.whatsappReady || !visit._id || !(visit.medicines || []).length) {
      return;
    }
    try {
      const pdf = await prescriptionPdfBase64(visit);
      this.visitService.sendPrescriptionPdf(visit._id, pdf).subscribe({
        next: (result) => this.showNotice(result.message, !result.sent),
        error: (err) =>
          this.showNotice(err?.error?.message || 'Prescription could not be sent on WhatsApp', true),
      });
    } catch (error) {
      this.showNotice((error as Error).message || 'Prescription PDF could not be made', true);
    }
  }

  private showNotice(message: string, isError: boolean): void {
    this.notice = message;
    this.noticeIsError = isError;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => (this.notice = ''), NOTICE_MS);
  }

  // ===== Loading from the server =====

  /**
   * Every 10 seconds asks the server "did anything change?" (a tiny request).
   * Only then fetches the changed visits, so the lab's "Reports ready" shows up by itself.
   */
  private checkForChanges(): void {
    this.visitService.pulse().subscribe({
      next: (pulse) => {
        const stamp = `${pulse.latest}|${pulse.count}`;
        if (this.lastPulse && stamp !== this.lastPulse) {
          this.refreshVisits(pulse.count);
          this.serverChanged$.next();
        }
        this.lastPulse = stamp;
      },
      error: () => {},
    });
  }

  private loadVisits(): void {
    this.visitService.getVisits().subscribe({
      next: (visits) => this.applyVisits(visits),
      error: (error) => {
        if (error.status === 401) {
          this.router.navigate(['/login']);
          return;
        }
        alert('Visits could not be loaded.');
      },
    });
  }

  /**
   * Quick refresh: fetches only the visits changed since the last load and merges them in.
   * Falls back to a full reload when the count does not match (for example a visit was deleted).
   */
  private refreshVisits(serverCount?: number): void {
    if (!this.syncedAt) {
      this.loadVisits();
      return;
    }
    if (this.syncing) {
      return;
    }
    this.syncing = true;
    this.visitService.getChangedVisits(this.syncedAt).subscribe({
      next: (changed) => {
        this.syncing = false;
        const byId = new Map(this.visits.map((visit) => [visit._id, visit]));
        changed.forEach((visit) => byId.set(visit._id, visit));
        const merged = [...byId.values()].sort((a, b) => visitTime(b) - visitTime(a));
        if (serverCount !== undefined && merged.length !== serverCount) {
          this.loadVisits();
          return;
        }
        this.applyVisits(merged);
      },
      error: () => {
        this.syncing = false;
        this.loadVisits();
      },
    });
  }

  private applyVisits(visits: Visit[]): void {
    this.visits = visits;
    this.syncedAt = visits.reduce<string | null>(
      (latest, visit) => (visit.updatedAt && (!latest || visit.updatedAt > latest) ? visit.updatedAt : latest),
      null,
    );
    if (this.selectedQueueVisit?._id) {
      this.selectedQueueVisit = visits.find((visit) => visit._id === this.selectedQueueVisit?._id) || null;
    }
  }
}
