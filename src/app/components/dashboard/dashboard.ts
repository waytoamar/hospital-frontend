import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { isAbnormal } from '../../services/visit';
import {
  Comorbidities,
  Examination,
  Medicine,
  Visit,
  VisitService,
  VisitStatus,
  Vitals,
} from '../../services/visit';
import { ExcelExportService } from '../../excel-export.service';
import {
  isPreprintedPaper,
  printPrescription,
  setPreprintedPaper,
} from '../../services/prescription-print';

type View = 'board' | 'patients' | 'records';
type FormStep = 1 | 2 | 3 | 4;
type BoardFilter = 'all' | 'waiting' | 'consult' | 'lab' | 'followup' | 'done';
type PanelKey = Exclude<BoardFilter, 'all'>;
type ComorbidityNoteKey = 'drugAllergyDetails' | 'surgicalComplicationsNote';
type SuggestionField =
  'symptoms' | 'diagnosis' | 'comments' | 'labInvestigations' | ExamNoteKey | ComorbidityNoteKey;
type ExamCheckKey =
  | 'anaemia'
  | 'jaundice'
  | 'clubbing'
  | 'cyanosis'
  | 'pedalEdema'
  | 'lymphNode'
  | 'nilSignificant'
  | 'others';
type ExamNoteKey = 'cvs' | 'rs' | 'cns' | 'gi';
type ComorbidityKey =
  | 'nil'
  | 'htn'
  | 'dm'
  | 'cad'
  | 'cva'
  | 'allergy'
  | 'atopy'
  | 'asthma'
  | 'copd'
  | 'ild'
  | 'hypothyroidism'
  | 'others';

// "Others" tick + a free-text note, added on top of the shared Examination / Comorbidities types
type ExamForm = Examination & { others: boolean; othersNote: string };
type ComorbidityForm = Comorbidities & { others: boolean; othersNote: string };

type YesNoField = 'drugAllergy' | 'surgicalComplications' | 'smoker' | 'alcoholic';

interface BoardPanel {
  key: PanelKey;
  label: string;
  note: string;
  empty: string;
  visits: Visit[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  photoView: string | null = null;
  // Print on paper that already has the clinic header: header is not printed
  preprintedPaper = isPreprintedPaper();
  isAbnormal = isAbnormal;
  activeView: View = 'board';
  boardFilter: BoardFilter = 'all';
  now = new Date();
  formOpen = false;
  formStep: FormStep = 1;
  editingId: string | null = null;
  selectedPatientKey = '';
  selectedQueueVisit: Visit | null = null;
  selectedQueuePanel: PanelKey = 'waiting';
  queueBusy = false;
  prefilledFrom = '';

  @ViewChild('queueStage') private queueStage?: ElementRef<HTMLElement>;

  searchTerm = '';
  filterStartDate = '';
  filterEndDate = '';
  visits: Visit[] = [];

  nextPatientId = '';
  patientId = '';
  phone = '';
  patientName = '';
  age = '';
  gender = '';
  disease = '';
  symptoms = '';
  diagnosis = '';
  allergies = '';
  vitals: Vitals = this.emptyVitals();
  examination: ExamForm = this.emptyExamination();
  comorbidities: ComorbidityForm = this.emptyComorbidities();
  labInvestigations = '';
  comments = '';
  medicines: Medicine[] = [this.emptyMedicine()];
  followUpDate = '';
  status: VisitStatus = 'Waiting';
  activeSuggestionField: SuggestionField | null = null;

  readonly dosageOptions = [
    '1 tablet',
    '1/2 tablet',
    '2 tablets',
    '5 ml',
    '10 ml',
    'Capsule',
    'Respule',
    'Ointment',
    'Lotion',
    'Puffs',
  ];

  readonly frequencyOptions = [
    '1-0-0',
    '0-1-0',
    '0-0-1',
    '1-0-1',
    '1-1-1',
    '2-0-2',
    '0-0-2',
    'SOS',
  ];

  readonly timingOptions = [
    'Before food',
    'After food',
    'With food',
    'Empty stomach',
    'Not related to food',
    'Before Breakfast',
    '1hr Before food',
  ];

  readonly examChecks: { key: ExamCheckKey; label: string }[] = [
    { key: 'anaemia', label: 'Anaemia' },
    { key: 'jaundice', label: 'Jaundice' },
    { key: 'clubbing', label: 'Clubbing' },
    { key: 'cyanosis', label: 'Cyanosis' },
    { key: 'pedalEdema', label: 'Pedal edema' },
    { key: 'lymphNode', label: 'Lymph node' },
    { key: 'nilSignificant', label: 'Nil significant' },
    { key: 'others', label: 'Others' },
  ];

  readonly examNotes: { key: ExamNoteKey; label: string }[] = [
    { key: 'cvs', label: 'CVS' },
    { key: 'rs', label: 'RS' },
    { key: 'cns', label: 'CNS' },
    { key: 'gi', label: 'GI' },
  ];

  readonly comorbidityChecks: { key: ComorbidityKey; label: string }[] = [
    { key: 'nil', label: 'Nil' },
    { key: 'htn', label: 'HTN' },
    { key: 'dm', label: 'DM' },
    { key: 'cad', label: 'CAD' },
    { key: 'cva', label: 'CVA' },
    { key: 'allergy', label: 'Allergy' },
    { key: 'atopy', label: 'Atopy' },
    { key: 'asthma', label: 'Asthma' },
    { key: 'copd', label: 'COPD' },
    { key: 'ild', label: 'ILD' },
    { key: 'hypothyroidism', label: 'Hypothyroidism' },
    { key: 'others', label: 'Others' },
  ];

  readonly statuses: VisitStatus[] = [
    'Waiting',
    'In consultation',
    'Lab investigation',
    'Completed',
    'No show',
  ];

  get diseaseSuggestions(): string[] {
    return this.uniqueSuggestions(this.visits.map((visit) => visit.disease));
  }

  // Durations typed in earlier prescriptions (e.g. "5 days") - shown when the field is clicked
  get durationSuggestions(): string[] {
    return this.uniqueSuggestions(
      this.visits.flatMap((visit) => (visit.medicines || []).map((medicine) => medicine.duration)),
    );
  }

  get medicineSuggestions(): string[] {
    return this.uniqueSuggestions(
      this.visits.flatMap((visit) => (visit.medicines || []).map((medicine) => medicine.name)),
    );
  }

  openSuggestions(field: SuggestionField): void {
    this.activeSuggestionField = field;
  }

  closeSuggestions(): void {
    this.activeSuggestionField = null;
  }

  // ---- helpers: where each suggestion field lives (form value + saved value in old visits) ----
  private isExamNote(field: SuggestionField): field is ExamNoteKey {
    return field === 'cvs' || field === 'rs' || field === 'cns' || field === 'gi';
  }

  private isComorbidityNote(field: SuggestionField): field is ComorbidityNoteKey {
    return field === 'drugAllergyDetails' || field === 'surgicalComplicationsNote';
  }

  private fieldValue(field: SuggestionField): string {
    if (this.isExamNote(field)) {
      return String(this.examination[field] || '');
    }
    if (this.isComorbidityNote(field)) {
      return String(this.comorbidities[field] || '');
    }
    return String(this[field] || '');
  }

  private setFieldValue(field: SuggestionField, value: string): void {
    if (this.isExamNote(field)) {
      this.examination[field] = value;
    } else if (this.isComorbidityNote(field)) {
      this.comorbidities[field] = value;
    } else {
      this[field] = value;
    }
  }

  private savedValue(visit: Visit, field: SuggestionField): string | undefined {
    if (this.isExamNote(field)) {
      return visit.examination?.[field];
    }
    if (this.isComorbidityNote(field)) {
      return visit.comorbidities?.[field];
    }
    return visit[field];
  }

  filteredSuggestions(field: SuggestionField): string[] {
    const values = this.uniqueSuggestions(
      this.visits.map((visit) => this.savedValue(visit, field)),
    );
    const query = this.fieldValue(field).trim().toLowerCase();

    return values.filter((value) => !query || value.toLowerCase().includes(query)).slice(0, 8);
  }

  selectSuggestion(field: SuggestionField, value: string): void {
    this.setFieldValue(field, value);
    this.activeSuggestionField = null;
    this.saveDraft();
  }

  acceptFirstSuggestion(field: SuggestionField, event: Event): void {
    const first = this.filteredSuggestions(field)[0];
    if (!first) {
      return;
    }

    event.preventDefault();
    this.selectSuggestion(field, first);
  }

  private readonly draftKey = 'clinic-visit-draft-v2';
  private readonly previewCount = 3;
  private clockTimer?: ReturnType<typeof setInterval>;
  private pulseTimer?: ReturnType<typeof setInterval>;
  private lastPulse = '';
  private expandedPanels = new Set<PanelKey>();

  private tokenSource: Visit[] | null = null;
  private tokenLength = -1;
  private tokenMap = new Map<string, string>();

  constructor(
    private authService: AuthService,
    private visitService: VisitService,
    private excelExport: ExcelExportService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadVisits();
    this.pulseTimer = setInterval(() => this.checkForChanges(), 10000);

    this.clockTimer = setInterval(() => {
      this.now = new Date();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
    }
  }

  get username(): string {
    return this.authService.getUsername();
  }

  get todayVisits(): Visit[] {
    const today = new Date().toDateString();

    return this.visits.filter(
      (visit) => visit.visitDate && new Date(visit.visitDate).toDateString() === today,
    );
  }

  get waitingVisits(): Visit[] {
    return this.todayVisits.filter((visit) => visit.status === 'Waiting');
  }

  get consultingVisits(): Visit[] {
    return this.todayVisits.filter((visit) => visit.status === 'In consultation');
  }

  // Patients at the lab stay on the board even if they were sent on an earlier day
  get labVisits(): Visit[] {
    return this.visits.filter((visit) => visit.status === 'Lab investigation');
  }

  get completedVisits(): Visit[] {
    return this.todayVisits.filter((visit) => visit.status === 'Completed');
  }

  // Latest visit time of every patient. A follow-up is "still waiting for the patient"
  // only while it belongs to the patient's LATEST visit. Once the patient has come back
  // (a newer visit exists), the old follow-up entry disappears from the list.
  private latestVisitTimes(): Map<string, number> {
    const latest = new Map<string, number>();
    this.visits.forEach((visit) => {
      const key = this.patientKey(visit);
      const time = this.timeOf(visit);
      if (time > (latest.get(key) ?? 0)) {
        latest.set(key, time);
      }
    });
    return latest;
  }

  get upcomingFollowUps(): Visit[] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    const latest = this.latestVisitTimes();

    return this.visits
      .filter((visit) => {
        if (!visit.followUpDate) {
          return false;
        }

        if (this.timeOf(visit) < (latest.get(this.patientKey(visit)) ?? 0)) {
          return false; // patient already came back
        }

        const followUp = new Date(`${visit.followUpDate}T00:00:00`);

        return followUp >= start && followUp <= end;
      })
      .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!))
      .slice(0, 5);
  }

  private matchesSearch(visit: Visit): boolean {
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

  private matchesDate(visit: Visit): boolean {
    if (!this.filterStartDate && !this.filterEndDate) {
      return true;
    }
    if (!visit.visitDate) {
      return false;
    }
    const day = new Date(visit.visitDate).toLocaleDateString('en-CA');
    if (this.filterStartDate && day < this.filterStartDate) {
      return false;
    }
    if (this.filterEndDate && day > this.filterEndDate) {
      return false;
    }
    return true;
  }

  get filteredVisits(): Visit[] {
    return this.visits.filter((visit) => this.matchesSearch(visit) && this.matchesDate(visit));
  }

  get patients(): Visit[] {
    const patientMap = new Map<string, Visit>();

    this.visits.forEach((visit) => {
      if (!this.matchesSearch(visit)) {
        return;
      }
      const key = this.patientKey(visit);

      if (!patientMap.has(key)) {
        patientMap.set(key, visit);
      }
    });

    return [...patientMap.values()];
  }

  get selectedPatientVisits(): Visit[] {
    return this.visits.filter((visit) => this.patientKey(visit) === this.selectedPatientKey);
  }

  // ===== Board (new design) =====

  get initial(): string {
    return (this.username || '?').trim().charAt(0).toUpperCase();
  }

  get searchPlaceholder(): string {
    return `Search name, ID, phone or token — ${this.todayVisits.length} in today's`;
  }

  get nowCalling(): string {
    const current =
      this.selectedQueueVisit ||
      [...this.consultingVisits].sort((a, b) => this.timeOf(b) - this.timeOf(a))[0];

    return this.tokenOf(current) || '—';
  }

  get upNextVisits(): Visit[] {
    const selectedId = this.selectedQueueVisit?._id;

    return this.boardWaiting.filter((visit) => visit._id !== selectedId).slice(0, 4);
  }

  get queueActionLabel(): string {
    if (this.selectedQueuePanel === 'followup') {
      return 'Start new visit';
    }

    if (this.selectedQueueVisit?.status === 'In consultation') {
      return 'Complete consultation';
    }

    if (this.selectedQueueVisit?.status === 'Lab investigation') {
      return 'Reports back — resume consultation';
    }

    return 'Call next patient';
  }

  get boardWaiting(): Visit[] {
    return this.waitingVisits
      .filter((visit) => this.matchesSearch(visit))
      .sort((a, b) => this.timeOf(a) - this.timeOf(b));
  }

  get boardConsulting(): Visit[] {
    return this.consultingVisits
      .filter((visit) => this.matchesSearch(visit))
      .sort((a, b) => this.timeOf(a) - this.timeOf(b));
  }

  get boardLab(): Visit[] {
    return this.labVisits
      .filter((visit) => this.matchesSearch(visit))
      .sort((a, b) => this.timeOf(a) - this.timeOf(b));
  }

  get boardCompleted(): Visit[] {
    return this.completedVisits
      .filter((visit) => this.matchesSearch(visit))
      .sort((a, b) => this.timeOf(b) - this.timeOf(a));
  }

  get boardFollowUps(): Visit[] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    const latest = this.latestVisitTimes();

    return this.visits
      .filter((visit) => {
        if (!visit.followUpDate) {
          return false;
        }

        if (this.timeOf(visit) < (latest.get(this.patientKey(visit)) ?? 0)) {
          return false; // patient already came back: no longer "waiting to come"
        }

        const followUp = new Date(`${visit.followUpDate}T00:00:00`);

        return followUp >= start && followUp <= end && this.matchesSearch(visit);
      })
      .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!));
  }

  get boardPanels(): BoardPanel[] {
    const panels: BoardPanel[] = [
      {
        key: 'waiting',
        label: 'WAITING',
        note: 'checked in today',
        empty: 'No patients waiting',
        visits: this.boardWaiting,
      },
      {
        key: 'consult',
        label: 'IN CONSULTATION',
        note: 'active now',
        empty: 'No active consultation',
        visits: this.boardConsulting,
      },
      {
        key: 'lab',
        label: 'LAB INVESTIGATION',
        note: 'gone for tests / reports',
        empty: 'No patients at the lab',
        visits: this.boardLab,
      },
      {
        key: 'followup',
        label: 'FOLLOW-UP',
        note: 'due in next 7 days',
        empty: 'No follow-ups this week',
        visits: this.boardFollowUps,
      },
      {
        key: 'done',
        label: 'COMPLETED',
        note: 'since morning',
        empty: 'No completed visits',
        visits: this.boardCompleted,
      },
    ];

    return this.boardFilter === 'all'
      ? panels
      : panels.filter((panel) => panel.key === this.boardFilter);
  }

  setBoardFilter(filter: BoardFilter): void {
    this.boardFilter = filter;
  }

  selectQueuePatient(visit: Visit, panel: PanelKey): void {
    this.selectedQueueVisit = visit;
    this.selectedQueuePanel = panel;

    setTimeout(() => {
      this.queueStage?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  closeQueue(): void {
    this.selectedQueueVisit = null;
  }

  runQueueAction(): void {
    const visit = this.selectedQueueVisit;
    if (!visit || this.queueBusy) {
      return;
    }

    if (this.selectedQueuePanel === 'followup') {
      this.openNewVisit(visit);
      return;
    }

    const nextStatus: VisitStatus =
      visit.status === 'In consultation' ? 'Completed' : 'In consultation';
    const fromLab = visit.status === 'Lab investigation';

    if (!visit._id) {
      return;
    }

    this.queueBusy = true;
    this.visitService.updateStatus(visit._id, nextStatus).subscribe({
      next: (updatedVisit) => {
        visit.status = updatedVisit.status;
        this.queueBusy = false;

        if (nextStatus === 'Completed') {
          this.selectedQueuePanel = 'done';
          return;
        }

        if (fromLab) {
          // Reports are back: open the visit so the doctor can see them and write medicines
          this.selectedQueuePanel = 'consult';
          this.editVisit(visit);
          return;
        }

        const next = this.upNextVisits[0];
        if (next) {
          this.selectedQueueVisit = next;
          this.selectedQueuePanel = 'waiting';
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

  trackByKey(_: number, panel: BoardPanel): string {
    return panel.key;
  }

  trackById(index: number, visit: Visit): string {
    return visit._id || String(index);
  }

  isExpanded(key: PanelKey): boolean {
    return this.expandedPanels.has(key);
  }

  togglePanel(key: PanelKey): void {
    if (this.expandedPanels.has(key)) {
      this.expandedPanels.delete(key);
    } else {
      this.expandedPanels.add(key);
    }
  }

  visibleRows(panel: BoardPanel): Visit[] {
    if (this.boardFilter !== 'all' || this.isExpanded(panel.key)) {
      return panel.visits;
    }

    return panel.visits.slice(0, this.previewCount);
  }

  hiddenCount(panel: BoardPanel): number {
    if (this.boardFilter !== 'all') {
      return 0;
    }

    return Math.max(0, panel.visits.length - this.previewCount);
  }

  ageSex(visit: Visit): string {
    const age = String(visit.age ?? '').trim();
    const sex = String(visit.gender ?? '')
      .trim()
      .charAt(0)
      .toUpperCase();

    return `${age}${sex}`;
  }

  rowMeta(key: PanelKey, visit: Visit): string {
    const token = this.tokenOf(visit);
    const time = visit.visitDate
      ? new Date(visit.visitDate).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const issue = visit.disease || visit.diagnosis || visit.symptoms || 'General';

    let parts: string[];

    switch (key) {
      case 'waiting':
        parts = [token, time, issue, this.waitLabel(visit)];
        break;

      case 'followup': {
        const due = visit.followUpDate
          ? new Date(`${visit.followUpDate}T00:00:00`).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
            })
          : '';

        parts = [token, due ? `Due ${due}` : '', visit.diagnosis || issue];
        break;
      }

      case 'lab':
        parts = [token, visit.labInvestigations || 'Tests ordered'];
        break;

      case 'done':
        parts = [token, time, visit.diagnosis || issue];
        break;

      default:
        parts = [token, time, issue];
    }

    return parts.filter(Boolean).join(' · ');
  }

  tokenOf(visit?: Visit): string {
    if (!visit) {
      return '';
    }

    if (this.tokenSource !== this.visits || this.tokenLength !== this.visits.length) {
      this.tokenSource = this.visits;
      this.tokenLength = this.visits.length;
      this.tokenMap = new Map<string, string>();

      [...this.todayVisits]
        .sort((a, b) => this.timeOf(a) - this.timeOf(b))
        .forEach((item, index) => {
          if (item._id) {
            this.tokenMap.set(item._id, `A-${String(index + 1).padStart(3, '0')}`);
          }
        });
    }

    return (visit._id && this.tokenMap.get(visit._id)) || '';
  }

  private waitLabel(visit: Visit): string {
    const minutes = Math.max(0, Math.round((this.now.getTime() - this.timeOf(visit)) / 60000));

    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  private timeOf(visit: Visit): number {
    return visit.visitDate ? new Date(visit.visitDate).getTime() : 0;
  }

  switchView(view: View): void {
    this.activeView = view;
    this.selectedPatientKey = '';
  }

  openStaff(): void {
    this.router.navigate(['/staff']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  loadNextPatientId(): void {
    this.visitService.getNextPatientId().subscribe({
      next: (result) => {
        this.nextPatientId = result.patientId;
      },
      error: () => {
        this.nextPatientId = '';
      },
    });
  }

  openNewVisit(patient?: Visit): void {
    this.clearForm();

    if (patient) {
      this.fillPatient(patient);
      this.prefillFromLast(patient);
    } else {
      this.restoreDraft();
    }

    this.loadNextPatientId();
    this.formOpen = true;
    this.formStep = 1;
  }

  closeForm(): void {
    if (this.hasFormData() && !confirm('Close this form? Your auto-saved draft will be kept.')) {
      return;
    }

    this.formOpen = false;
  }

  private patientStepValid(): boolean {
    return (
      !!this.patientName.trim() &&
      /^\d{1,3}$/.test(this.age) &&
      !!this.gender &&
      /^\d{10}$/.test(this.phone)
    );
  }

  // Click any step tab at the top - no need to fill the earlier steps first.
  openStep(step: number): void {
    this.formStep = step as FormStep;
    this.saveDraft();
  }

  nextStep(): void {
    if (this.formStep === 1 && !this.patientStepValid()) {
      alert('Enter patient name, valid age, gender and 10-digit phone number.');
      return;
    }

    this.saveDraft();

    if (this.formStep < 4) {
      this.formStep = (this.formStep + 1) as FormStep;
    }
  }

  previousStep(): void {
    if (this.formStep > 1) {
      this.formStep = (this.formStep - 1) as FormStep;
    }
  }

  goToStep(step: number): void {
    if (step <= this.formStep) {
      this.formStep = step as FormStep;
      return;
    }
    while (this.formStep < step) {
      const before = this.formStep;
      this.nextStep();
      if (this.formStep === before) {
        return;
      }
    }
  }

  searchExistingPatient(): void {
    const phone = this.phone.trim();
    const patientId = this.patientId.trim().toLowerCase();

    const patient = this.visits.find(
      (visit) =>
        (phone && visit.phone === phone) ||
        (patientId && visit.patientId?.toLowerCase() === patientId),
    );

    if (!patient) {
      alert('No previous patient found. Continue as a new patient.');
      return;
    }

    this.fillPatient(patient);
    alert('Patient details loaded.');
  }

  addMedicineRow(): void {
    this.medicines.push(this.emptyMedicine());
    this.saveDraft();
  }

  removeMedicineRow(index: number): void {
    this.medicines.splice(index, 1);

    if (!this.medicines.length) {
      this.medicines.push(this.emptyMedicine());
    }

    this.saveDraft();
  }

  saveVisit(): void {
    if (!this.patientStepValid()) {
      this.formStep = 1;
      alert('Enter patient name, valid age, gender and 10-digit phone number.');
      return;
    }

    if (!confirm(this.editingId ? 'Update this visit?' : 'Save this visit?')) {
      return;
    }

    const medicines = this.medicines.filter((medicine) => medicine.name.trim());

    const visit: Visit = {
      patientId: this.patientId.trim(),
      phone: this.phone.trim(),
      patientName: this.patientName.trim(),
      age: this.age,
      gender: this.gender,
      disease: this.disease.trim(),
      symptoms: this.symptoms.trim(),
      diagnosis: this.diagnosis.trim(),
      allergies: this.allergies.trim(),
      vitals: { ...this.vitals },
      examination: { ...this.examination },
      comorbidities: { ...this.comorbidities },
      labInvestigations: this.labInvestigations.trim(),
      comments: this.comments.trim(),
      medicines,
      followUpDate: this.followUpDate || undefined,
      status: this.status,
    };

    const request = this.editingId
      ? this.visitService.updateVisit(this.editingId, visit)
      : this.visitService.addVisit(visit);

    request.subscribe({
      next: () => {
        localStorage.removeItem(this.draftKey);
        this.formOpen = false;
        this.clearForm();
        this.loadVisits();
        this.loadNextPatientId();
      },
      error: (error) => alert(error?.error?.message || 'Visit could not be saved.'),
    });
  }

  editVisit(visit: Visit): void {
    this.clearForm();
    this.editingId = visit._id || null;
    this.fillAll(visit);

    // Empty visit registered by reception: load the patient's last visit data
    if (!visit.disease && !visit.diagnosis && !visit.medicines?.length) {
      this.prefillFromLast(visit, visit._id);
    }

    this.formOpen = true;
    this.formStep = 1;
  }

  deleteVisit(id?: string): void {
    if (!id || !confirm('Delete this visit permanently?')) {
      return;
    }

    this.visitService.deleteVisit(id).subscribe({
      next: () => this.loadVisits(),
      error: () => alert('Visit could not be deleted.'),
    });
  }

  setStatus(visit: Visit, status: VisitStatus): void {
    if (!visit._id) {
      return;
    }

    this.visitService.updateStatus(visit._id, status).subscribe({
      next: (updatedVisit) => {
        visit.status = updatedVisit.status;
        if (this.selectedQueueVisit?._id === visit._id) {
          this.selectedQueueVisit = visit;
        }
      },
      error: () => alert('Status could not be updated.'),
    });
  }

  toggleExam(key: ExamCheckKey): void {
    const turningOn = !this.examination[key];

    if (key === 'nilSignificant' && turningOn) {
      // "Nil significant": untick EVERYTHING else (Anaemia, Jaundice ... and Others + its text)
      this.examChecks.forEach((item) => {
        this.examination[item.key] = false;
      });
      this.examination.othersNote = '';
      this.examination.nilSignificant = true;
    } else {
      this.examination[key] = turningOn;
      // any real finding cancels "Nil significant"
      if (turningOn) {
        this.examination.nilSignificant = false;
      }
      // unticking "Others" clears what was written there
      if (key === 'others' && !turningOn) {
        this.examination.othersNote = '';
      }
    }
    this.saveDraft();
  }

  toggleComorbidity(key: ComorbidityKey): void {
    const turningOn = !this.comorbidities[key];

    if (key === 'nil' && turningOn) {
      // "Nil": untick EVERYTHING else (HTN, DM ... and Others + its text)
      this.comorbidityChecks.forEach((item) => {
        this.comorbidities[item.key] = false;
      });
      this.comorbidities.othersNote = '';
      this.comorbidities.nil = true;
    } else {
      this.comorbidities[key] = turningOn;
      // any real comorbidity cancels "Nil"
      if (turningOn) {
        this.comorbidities.nil = false;
      }
      // unticking "Others" clears what was written there
      if (key === 'others' && !turningOn) {
        this.comorbidities.othersNote = '';
      }
    }
    this.saveDraft();
  }

  // Doctor orders tests: patient goes to the lab, then comes back with reports
  sendToLab(visit: Visit): void {
    if (!visit._id) {
      return;
    }
    if (!visit.labInvestigations?.trim()) {
      const tests = prompt('Which tests? (e.g. CBC, X-ray chest)', '');
      if (tests === null) {
        return;
      }
      if (tests.trim()) {
        const updated: Visit = {
          ...visit,
          labInvestigations: tests.trim(),
          status: 'Lab investigation',
        };
        this.visitService.updateVisit(visit._id, updated).subscribe({
          next: (saved) => Object.assign(visit, saved),
          error: () => alert('Could not send to lab.'),
        });
        return;
      }
    }
    this.setStatus(visit, 'Lab investigation');
  }

  // Reports are back: patient returns to the doctor, open the visit to write medicines
  resumeFromLab(visit: Visit): void {
    visit.status = 'In consultation';
    this.setStatus(visit, 'In consultation');
    this.editVisit(visit);
  }

  setYesNo(field: YesNoField, value: 'Yes' | 'No'): void {
    this.comorbidities[field] = this.comorbidities[field] === value ? '' : value;

    if (this.comorbidities.drugAllergy !== 'Yes') {
      this.comorbidities.drugAllergyDetails = '';
    }

    if (!this.comorbidities.surgicalComplications) {
      this.comorbidities.surgicalComplicationsNote = '';
    }

    this.saveDraft();
  }

  vitalsSummary(vitals?: Partial<Vitals>): string {
    const show = (value?: string) => (value && value.trim()) || '-';

    return [
      `BP ${show(vitals?.bloodPressure)}`,
      `SpO2 ${show(vitals?.spo2)}`,
      `Temp ${show(vitals?.temperature)}`,
      `RBS ${show(vitals?.bloodSugar)}`,
      `Weight ${show(vitals?.weight)}`,
      `HR ${show(vitals?.heartRate)}`,
    ].join(', ');
  }

  allergySummary(visit?: { allergies?: string; comorbidities?: Comorbidities }): string {
    const como = visit?.comorbidities;

    if (como?.drugAllergy === 'Yes') {
      return como.drugAllergyDetails
        ? `Drug allergy: ${como.drugAllergyDetails}`
        : 'Drug allergy: Yes';
    }

    if (visit?.allergies) {
      return visit.allergies;
    }

    return como?.drugAllergy === 'No' ? 'No drug allergy' : 'None recorded';
  }

  get reviewAllergy(): string {
    return this.allergySummary({
      allergies: this.allergies,
      comorbidities: this.comorbidities,
    });
  }

  openPatient(visit: Visit): void {
    this.selectedPatientKey = this.patientKey(visit);
  }

  closePatient(): void {
    this.selectedPatientKey = '';
  }

  onFilterChange(): void {
    // date filtering now happens locally in filteredVisits
  }

  clearFilter(): void {
    this.filterStartDate = '';
    this.filterEndDate = '';
  }

  exportToExcel(): void {
    if (!this.filteredVisits.length) {
      alert('No records to export.');
      return;
    }

    this.excelExport.exportVisits(this.filteredVisits);
  }

  togglePreprinted(event: Event): void {
    this.preprintedPaper = (event.target as HTMLInputElement).checked;
    setPreprintedPaper(this.preprintedPaper);
  }

  // Same print layout as the pharmacist's page (one shared function)
  printVisit(visit: Visit): void {
    printPrescription(visit);
  }

  // Every 10 seconds ask the server "did anything change?" (a tiny request).
  // Only when it did, reload the visits. So the lab's "Reports ready" shows up by itself.
  private checkForChanges(): void {
    this.visitService.pulse().subscribe({
      next: (p) => {
        const stamp = `${p.latest}|${p.count}`;
        if (this.lastPulse && stamp !== this.lastPulse) {
          this.loadVisits();
        }
        this.lastPulse = stamp;
      },
      error: () => {},
    });
  }

  private loadVisits(): void {
    this.visitService.getVisits().subscribe({
      next: (visits) => {
        this.visits = visits;
        if (this.selectedQueueVisit?._id) {
          this.selectedQueueVisit =
            visits.find((visit) => visit._id === this.selectedQueueVisit?._id) || null;
        }
      },
      error: (error) => {
        if (error.status === 401) {
          this.router.navigate(['/login']);
          return;
        }

        alert('Visits could not be loaded.');
      },
    });
  }

  private patientKey(visit: Visit): string {
    return visit.patientId || visit.phone || `${visit.patientName.toLowerCase()}-${visit.age}`;
  }

  private uniqueSuggestions(values: Array<string | undefined>): string[] {
    const seen = new Set<string>();

    return values.reduce<string[]>((suggestions, value) => {
      const cleaned = String(value || '').trim();
      const key = cleaned.toLowerCase();

      if (cleaned && !seen.has(key)) {
        seen.add(key);
        suggestions.push(cleaned);
      }

      return suggestions;
    }, []);
  }

  private emptyMedicine(): Medicine {
    return {
      name: '',
      dosage: '',
      frequency: '',
      duration: '',
      timing: '',
    };
  }

  private emptyVitals(): Vitals {
    return {
      bloodPressure: '',
      spo2: '',
      temperature: '',
      bloodSugar: '',
      weight: '',
      heartRate: '',
    };
  }

  private emptyExamination(): ExamForm {
    return {
      anaemia: false,
      jaundice: false,
      clubbing: false,
      cyanosis: false,
      pedalEdema: false,
      lymphNode: false,
      nilSignificant: false,
      others: false,
      othersNote: '',
      cvs: '',
      rs: '',
      cns: '',
      gi: '',
    };
  }

  private emptyComorbidities(): ComorbidityForm {
    return {
      nil: false,
      htn: false,
      dm: false,
      cad: false,
      cva: false,
      allergy: false,
      atopy: false,
      asthma: false,
      copd: false,
      ild: false,
      hypothyroidism: false,
      others: false,
      othersNote: '',
      drugAllergy: '',
      drugAllergyDetails: '',
      surgicalComplications: '',
      surgicalComplicationsNote: '',
      smoker: '',
      alcoholic: '',
    };
  }

  medLine(medicine: Medicine): string {
    return [medicine.dosage, medicine.frequency, medicine.duration, medicine.timing]
      .filter(Boolean)
      .join(' · ');
  }

  // Same patient's last filled visit: disease, diagnosis, comorbidities, medicines
  private prefillFromLast(patient: Visit, excludeId?: string): void {
    const key = this.patientKey(patient);
    const last = this.visits.find(
      (visit) =>
        visit._id !== excludeId &&
        this.patientKey(visit) === key &&
        (visit.disease || visit.diagnosis || visit.medicines?.length),
    );
    if (!last) {
      return;
    }

    this.disease = last.disease || '';
    this.diagnosis = last.diagnosis || '';
    this.comorbidities = { ...this.emptyComorbidities(), ...(last.comorbidities || {}) };
    this.medicines = last.medicines?.length
      ? last.medicines.map((medicine) => ({ ...this.emptyMedicine(), ...medicine }))
      : [this.emptyMedicine()];
    this.prefilledFrom = last.visitDate || '';
  }

  private fillPatient(visit: Visit): void {
    this.patientId = visit.patientId || '';
    this.phone = visit.phone || '';
    this.patientName = visit.patientName;
    this.age = visit.age;
    this.gender = visit.gender;
    this.allergies = visit.allergies || '';

    if (visit.comorbidities?.drugAllergy === 'Yes') {
      this.comorbidities.drugAllergy = 'Yes';
      this.comorbidities.drugAllergyDetails = visit.comorbidities.drugAllergyDetails || '';
    }
  }

  private fillAll(visit: Visit): void {
    this.fillPatient(visit);

    this.disease = visit.disease;
    this.symptoms = visit.symptoms;
    this.diagnosis = visit.diagnosis;

    this.vitals = {
      ...this.emptyVitals(),
      ...(visit.vitals || {}),
    };

    this.examination = {
      ...this.emptyExamination(),
      ...(visit.examination || {}),
    };

    this.comorbidities = {
      ...this.emptyComorbidities(),
      ...(visit.comorbidities || {}),
    };

    this.labInvestigations = visit.labInvestigations || '';

    this.comments = visit.comments || '';

    this.medicines = visit.medicines?.length
      ? visit.medicines.map((medicine) => ({
          ...this.emptyMedicine(),
          ...medicine,
        }))
      : [this.emptyMedicine()];

    this.followUpDate = visit.followUpDate || '';
    this.status = visit.status || 'Waiting';
  }

  private clearForm(): void {
    this.editingId = null;
    this.prefilledFrom = '';
    this.patientId = '';
    this.phone = '';
    this.patientName = '';
    this.age = '';
    this.gender = '';
    this.disease = '';
    this.symptoms = '';
    this.diagnosis = '';
    this.allergies = '';
    this.vitals = this.emptyVitals();
    this.examination = this.emptyExamination();
    this.comorbidities = this.emptyComorbidities();
    this.labInvestigations = '';
    this.comments = '';
    this.medicines = [this.emptyMedicine()];
    this.followUpDate = '';
    this.status = 'Waiting';
  }

  private hasFormData(): boolean {
    return Boolean(
      this.patientName ||
      this.phone ||
      this.age ||
      this.gender ||
      this.allergies ||
      this.disease ||
      this.symptoms ||
      this.diagnosis ||
      this.labInvestigations ||
      this.comments ||
      Object.values(this.vitals).some((value) => value) ||
      Object.values(this.examination).some((value) => value) ||
      Object.values(this.comorbidities).some((value) => value) ||
      this.medicines.some((medicine) => medicine.name.trim()),
    );
  }

  protected saveDraft(): void {
    if (this.editingId) {
      return;
    }

    localStorage.setItem(
      this.draftKey,
      JSON.stringify({
        patientId: this.patientId,
        phone: this.phone,
        patientName: this.patientName,
        age: this.age,
        gender: this.gender,
        disease: this.disease,
        symptoms: this.symptoms,
        diagnosis: this.diagnosis,
        allergies: this.allergies,
        vitals: this.vitals,
        examination: this.examination,
        comorbidities: this.comorbidities,
        labInvestigations: this.labInvestigations,
        comments: this.comments,
        medicines: this.medicines,
        followUpDate: this.followUpDate,
        status: this.status,
      }),
    );
  }

  private restoreDraft(): void {
    const savedDraft = localStorage.getItem(this.draftKey);

    if (!savedDraft) {
      return;
    }

    try {
      const draft = JSON.parse(savedDraft) as Partial<Visit>;

      if (confirm('Continue your auto-saved visit draft?')) {
        this.fillAll({
          ...draft,
          phone: draft.phone || '',
          patientName: draft.patientName || '',
          age: draft.age || '',
          gender: draft.gender || '',
          disease: draft.disease || '',
          symptoms: draft.symptoms || '',
          diagnosis: draft.diagnosis || '',
          allergies: draft.allergies || '',
          vitals: draft.vitals || this.emptyVitals(),
          medicines: draft.medicines || [],
          status: draft.status || 'Waiting',
        });

        return;
      }

      localStorage.removeItem(this.draftKey);
    } catch {
      localStorage.removeItem(this.draftKey);
    }
  }
}