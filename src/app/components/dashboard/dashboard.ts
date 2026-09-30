import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
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
import { LETTERHEAD_LOGO, LETTERHEAD_ORGANS } from './letterhead-images';

type View = 'board' | 'patients' | 'records';
type FormStep = 1 | 2 | 3 | 4;
type BoardFilter = 'all' | 'waiting' | 'consult' | 'followup' | 'done';
type PanelKey = Exclude<BoardFilter, 'all'>;
type SuggestionField = 'symptoms' | 'diagnosis' | 'comments';
type ExamCheckKey =
  | 'anaemia'
  | 'jaundice'
  | 'clubbing'
  | 'cyanosis'
  | 'pedalEdema'
  | 'lymphNode';
type ExamNoteKey = 'cvs' | 'rs' | 'cns' | 'gi';
type ComorbidityKey =
  | 'htn'
  | 'dm'
  | 'cad'
  | 'cva'
  | 'allergy'
  | 'atopy'
  | 'asthma'
  | 'copd'
  | 'ild';
type YesNoField = 'drugAllergy' | 'surgicalComplications';

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
  examination: Examination = this.emptyExamination();
  comorbidities: Comorbidities = this.emptyComorbidities();
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
    'Puffs'
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
  ];

  readonly examNotes: { key: ExamNoteKey; label: string }[] = [
    { key: 'cvs', label: 'CVS' },
    { key: 'rs', label: 'RS' },
    { key: 'cns', label: 'CNS' },
    { key: 'gi', label: 'GI' },
  ];

  readonly comorbidityChecks: { key: ComorbidityKey; label: string }[] = [
    { key: 'htn', label: 'HTN' },
    { key: 'dm', label: 'DM' },
    { key: 'cad', label: 'CAD' },
    { key: 'cva', label: 'CVA' },
    { key: 'allergy', label: 'Allergy' },
    { key: 'atopy', label: 'Atopy' },
    { key: 'asthma', label: 'Asthma' },
    { key: 'copd', label: 'COPD' },
    { key: 'ild', label: 'ILD' },
  ];

  readonly statuses: VisitStatus[] = [
    'Waiting',
    'In consultation',
    'Completed',
  ];

  get diseaseSuggestions(): string[] {
    return this.uniqueSuggestions(this.visits.map((visit) => visit.disease));
  }

  get medicineSuggestions(): string[] {
    return this.uniqueSuggestions(
      this.visits.flatMap((visit) =>
        (visit.medicines || []).map((medicine) => medicine.name),
      ),
    );
  }

  openSuggestions(field: SuggestionField): void {
    this.activeSuggestionField = field;
  }

  closeSuggestions(): void {
    this.activeSuggestionField = null;
  }

  filteredSuggestions(field: SuggestionField): string[] {
    const values = this.uniqueSuggestions(
      this.visits.map((visit) => visit[field]),
    );
    const query = this[field].trim().toLowerCase();

    return values
      .filter((value) => !query || value.toLowerCase().includes(query))
      .slice(0, 8);
  }

  selectSuggestion(field: SuggestionField, value: string): void {
    this[field] = value;
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

    this.clockTimer = setInterval(() => {
      this.now = new Date();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  get username(): string {
    return this.authService.getUsername();
  }

  get todayVisits(): Visit[] {
    const today = new Date().toDateString();

    return this.visits.filter(
      (visit) =>
        visit.visitDate &&
        new Date(visit.visitDate).toDateString() === today,
    );
  }

  get waitingVisits(): Visit[] {
    return this.todayVisits.filter(
      (visit) => visit.status === 'Waiting',
    );
  }

  get consultingVisits(): Visit[] {
    return this.todayVisits.filter(
      (visit) => visit.status === 'In consultation',
    );
  }

  get completedVisits(): Visit[] {
    return this.todayVisits.filter(
      (visit) => visit.status === 'Completed',
    );
  }

  get upcomingFollowUps(): Visit[] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    return this.visits
      .filter((visit) => {
        if (!visit.followUpDate) {
          return false;
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
    return this.visits.filter(
      (visit) => this.matchesSearch(visit) && this.matchesDate(visit),
    );
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
    return this.visits.filter(
      (visit) => this.patientKey(visit) === this.selectedPatientKey,
    );
  }

  // ===== Board (new design) =====

  get initial(): string {
    return (this.username || '?').trim().charAt(0).toUpperCase();
  }

  get searchPlaceholder(): string {
    return `Search name, ID, phone or token — ${this.todayVisits.length} in today's`;
  }

  get nowCalling(): string {
    const current = this.selectedQueueVisit || [...this.consultingVisits].sort(
      (a, b) => this.timeOf(b) - this.timeOf(a),
    )[0];

    return this.tokenOf(current) || '—';
  }

  get upNextVisits(): Visit[] {
    const selectedId = this.selectedQueueVisit?._id;

    return this.boardWaiting
      .filter((visit) => visit._id !== selectedId)
      .slice(0, 4);
  }

  get queueActionLabel(): string {
    if (this.selectedQueuePanel === 'followup') {
      return 'Start new visit';
    }

    if (this.selectedQueueVisit?.status === 'In consultation') {
      return 'Complete consultation';
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

    return this.visits
      .filter((visit) => {
        if (!visit.followUpDate) {
          return false;
        }

        const followUp = new Date(`${visit.followUpDate}T00:00:00`);

        return (
          followUp >= start &&
          followUp <= end &&
          this.matchesSearch(visit)
        );
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
    const sex = String(visit.gender ?? '').trim().charAt(0).toUpperCase();

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
    const issue =
      visit.disease || visit.diagnosis || visit.symptoms || 'General';

    let parts: string[];

    switch (key) {
      case 'waiting':
        parts = [token, time, issue, this.waitLabel(visit)];
        break;

      case 'followup': {
        const due = visit.followUpDate
          ? new Date(`${visit.followUpDate}T00:00:00`).toLocaleDateString(
              'en-GB',
              { day: '2-digit', month: 'short' },
            )
          : '';

        parts = [token, due ? `Due ${due}` : '', visit.diagnosis || issue];
        break;
      }

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

    if (
      this.tokenSource !== this.visits ||
      this.tokenLength !== this.visits.length
    ) {
      this.tokenSource = this.visits;
      this.tokenLength = this.visits.length;
      this.tokenMap = new Map<string, string>();

      [...this.todayVisits]
        .sort((a, b) => this.timeOf(a) - this.timeOf(b))
        .forEach((item, index) => {
          if (item._id) {
            this.tokenMap.set(
              item._id,
              `A-${String(index + 1).padStart(3, '0')}`,
            );
          }
        });
    }

    return (visit._id && this.tokenMap.get(visit._id)) || '';
  }

  private waitLabel(visit: Visit): string {
    const minutes = Math.max(
      0,
      Math.round((this.now.getTime() - this.timeOf(visit)) / 60000),
    );

    return minutes < 60
      ? `${minutes}m`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  private timeOf(visit: Visit): number {
    return visit.visitDate ? new Date(visit.visitDate).getTime() : 0;
  }

  switchView(view: View): void {
    this.activeView = view;
    this.selectedPatientKey = '';
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
    } else {
      this.restoreDraft();
    }

    this.loadNextPatientId();
    this.formOpen = true;
    this.formStep = 1;
  }

  closeForm(): void {
    if (
      this.hasFormData() &&
      !confirm('Close this form? Your auto-saved draft will be kept.')
    ) {
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
      alert(
        'Enter patient name, valid age, gender and 10-digit phone number.',
      );
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
        (
          patientId &&
          visit.patientId?.toLowerCase() === patientId
        ),
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
      alert(
        'Enter patient name, valid age, gender and 10-digit phone number.',
      );
      return;
    }

    if (
      !confirm(
        this.editingId
          ? 'Update this visit?'
          : 'Save this visit?',
      )
    ) {
      return;
    }

    const medicines = this.medicines.filter(
      (medicine) => medicine.name.trim(),
    );

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
      error: (error) =>
        alert(
          error?.error?.message ||
            'Visit could not be saved.',
        ),
    });
  }

  editVisit(visit: Visit): void {
    this.clearForm();
    this.editingId = visit._id || null;
    this.fillAll(visit);
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
    this.examination[key] = !this.examination[key];
    this.saveDraft();
  }

  toggleComorbidity(key: ComorbidityKey): void {
    this.comorbidities[key] = !this.comorbidities[key];
    this.saveDraft();
  }

  setYesNo(field: YesNoField, value: 'Yes' | 'No'): void {
    this.comorbidities[field] =
      this.comorbidities[field] === value ? '' : value;

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

  allergySummary(visit?: {
    allergies?: string;
    comorbidities?: Comorbidities;
  }): string {
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

  printVisit(visit: Visit): void {
    const escapeHtml = (value: unknown): string =>
      String(value || '').replace(
        /[&<>"']/g,
        (character) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[character] || character,
      );

    const has = (value: unknown): boolean =>
      String(value || '').trim().length > 0;

    const formatDate = (value?: string): string => {
      if (!value) {
        return '';
      }
      const [year, month, day] = value.split('-');
      return year && month && day ? `${day}/${month}/${year}` : value;
    };

    // ---- Letterhead text (edit here if anything changes) ----
    const clinic = {
      name: 'CHEST ALLERGY CLINIC',
      doctor: 'Dr. Mahesh C.',
      qualification: 'MBBS, DNB (PULMONOLOGY)',
      lines: [
        'FELLOWSHIP IN RESPIRATORY ICU',
        'INTENSIVIST SLEEP SPECIALIST',
        'ALLERGY SPECIALIST, INTERVENTIONAL PULMONOLOGIST',
        '(ASSIST. PROFESSOR DEPT. OF PULMONARY MEDICINE CIMS CWA',
        'EX. CONSULTANT WCL HOSPITAL BARKUHI)',
      ],
      phones: '8109838316, 8817483758',
      doctorHindi: 'डॉ. महेश सी.',
      conditionsHindi:
        'अस्थमा, दमा. सी.ओ.पी.डी.. आई.एल.डी.. निमोनिया, ट्यूबरक्लोसिस (टी.बी.) खासी. एलर्जी, ब्लडप्रेशर रोग, शुगर, थायराइड, हृदय रोग, लकवा. मिर्गी, नींद की बिमारी एवं छाती के संपूर्ण रोग',
      special: 'Critical Care (Icu) Ventilator Specialist, Bronchoscopy Specialist',
      addressHindi: 'मानसरोवर कॉम्पलेक्स. बस स्टैंड के पीछे छिन्दवाड़ा (म.प्र.)',
      footerHindi: 'दवाईयाँ डॉक्टर को दिखाकर ही सेवन करें',
    };

    // ---- Left column: only vitals that were filled in ----
    const v = visit.vitals;
    const vitalRows = [
      ['BP', v?.bloodPressure],
      ['Pulse', v?.heartRate],
      ['SPO2', v?.spo2],
      ['TEMP', v?.temperature],
      ['RBS', v?.bloodSugar],
      ['Weight', v?.weight],
    ]
      .filter(([, value]) => has(value))
      .map(
        ([label, value]) =>
          `<div class="vit"><span>${label}</span><b>${escapeHtml(value)}</b></div>`,
      )
      .join('');

    const section = (title: string, body: string): string =>
      body ? `<div class="block"><h4>${title}</h4>${body}</div>` : '';

    const ticks = (labels: string[]): string =>
      labels.length
        ? `<p>${labels
            .map((label) => `<span class="tk">✓ ${escapeHtml(label)}</span>`)
            .join('')}</p>`
        : '';

    // ---- Symptoms ----
    const symptomsSection = section(
      'Symptoms',
      has(visit.symptoms) ? `<p>${escapeHtml(visit.symptoms)}</p>` : '',
    );

    // ---- Clinical examination: ticked items + written findings only ----
    const exam = visit.examination;
    const examTicked = this.examChecks
      .filter((item) => exam?.[item.key])
      .map((item) => item.label);
    const examFindings = this.examNotes
      .filter((item) => has(exam?.[item.key]))
      .map(
        (item) =>
          `<p><b>${item.label}:</b> ${escapeHtml(exam?.[item.key])}</p>`,
      )
      .join('');
    const examSection = section(
      'Clinical Examination',
      ticks(examTicked) + examFindings,
    );

    // ---- Comorbidities: ticked items + answered Yes/No only ----
    const como = visit.comorbidities;
    const comoTicked = this.comorbidityChecks
      .filter((item) => como?.[item.key])
      .map((item) => item.label);

    const comoLines: string[] = [];
    const drugDetails = como?.drugAllergyDetails;
    const surgicalNote = como?.surgicalComplicationsNote;

    if (como?.drugAllergy === 'Yes') {
      comoLines.push(
        `<p><b>Drug allergy:</b> Yes${has(drugDetails) ? ' — ' + escapeHtml(drugDetails) : ''}</p>`,
      );
    } else if (como?.drugAllergy === 'No') {
      comoLines.push('<p><b>Drug allergy:</b> No</p>');
    } else if (has(visit.allergies)) {
      comoLines.push(`<p><b>Allergies:</b> ${escapeHtml(visit.allergies)}</p>`);
    }

    if (como?.surgicalComplications) {
      comoLines.push(
        `<p><b>Previous surgical complications:</b> ${como.surgicalComplications}${has(surgicalNote) ? ' — ' + escapeHtml(surgicalNote) : ''}</p>`,
      );
    }

    const comoSection = section(
      'Comorbidities',
      ticks(comoTicked) + comoLines.join(''),
    );

    // ---- Investigations ----
    const investigationsSection = section(
      'Investigations',
      has(visit.labInvestigations)
        ? `<p>${escapeHtml(visit.labInvestigations)}</p>`
        : '',
    );

    // ---- Diagnosis ----
    const diagnosisSection = section(
      'Diagnosis',
      (has(visit.disease)
        ? `<p><b>Disease:</b> ${escapeHtml(visit.disease)}</p>`
        : '') +
        (has(visit.diagnosis) ? `<p>${escapeHtml(visit.diagnosis)}</p>` : ''),
    );

    // ---- Medication ----
    const medicineRows = (visit.medicines || [])
      .map(
        (medicine, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(medicine.name)}</td>
            <td>${escapeHtml(medicine.dosage)}</td>
            <td>${escapeHtml(medicine.frequency)}</td>
            <td>${escapeHtml(medicine.duration)}</td>
            <td>${escapeHtml(medicine.timing)}</td>
          </tr>
        `,
      )
      .join('');

    const medicineSection = medicineRows
      ? `
        <div class="rx">Rx</div>
        <table class="meds">
          <thead>
            <tr>
              <th>#</th>
              <th>Medicine</th>
              <th>Dose</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Food</th>
            </tr>
          </thead>
          <tbody>${medicineRows}</tbody>
        </table>`
      : '';

    const adviceSection = section(
      'Advice',
      has(visit.comments) ? `<p>${escapeHtml(visit.comments)}</p>` : '',
    );

    const followUpSection = has(visit.followUpDate)
      ? `<p class="follow"><b>Follow-up date:</b> ${escapeHtml(formatDate(visit.followUpDate))}</p>`
      : '';

    const visitDate = visit.visitDate
      ? new Date(visit.visitDate).toLocaleDateString('en-IN')
      : '';

    const printWindow = window.open(
      '',
      '_blank',
      'width=900,height=900',
    );

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Prescription</title>
          <style>
            @page { size: A4; margin: 0; }

            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 14px;
              line-height: 1.4;
              color: #111;
            }

            .hi {
              font-family: 'Nirmala UI', 'Mangal', 'Noto Sans Devanagari',
                'Kohinoor Devanagari', Arial, sans-serif;
            }

            .page {
              position: relative;
              min-height: 296mm;
              padding-bottom: 34mm;
            }

            /* ---- Letterhead ---- */
            .lh { position: relative; padding: 7mm 10mm 0 8mm; }

            .reg {
              position: absolute;
              top: 3mm;
              right: 10mm;
              font-size: 11px;
              color: #222;
            }

            .organs {
              position: absolute;
              top: 8mm;
              right: 10mm;
              width: 46mm;
              height: auto;
            }

            .hi-top { min-height: 15mm; padding-right: 50mm; }

            .lh h1 {
              margin: 0;
              font-family: Impact, 'Arial Black', Arial, sans-serif;
              font-size: 44px;
              font-weight: 900;
              letter-spacing: 1px;
              line-height: 1.05;
              color: #1b7fc4;
            }

            .lh-cols {
              display: flex;
              gap: 10px;
              align-items: flex-start;
              margin-top: 4px;
            }

            .lh-l { flex: 1.25; }
            .lh-r { flex: 1.4; }
            .lh-logo { flex: none; width: 60px; padding-top: 14px; }

            .dr {
              font-family: Georgia, 'Times New Roman', serif;
              font-size: 28px;
              font-weight: 700;
              line-height: 1.1;
              color: #8c1c1c;
            }

            .lh-r .dr { font-size: 26px; }
            .q { font-weight: 700; font-size: 13px; margin-top: 2px; }
            .s { font-size: 11px; line-height: 1.3; text-transform: uppercase; }
            .ph { font-weight: 700; font-size: 14px; margin-top: 3px; }
            .cond { font-size: 11px; font-weight: 700; line-height: 1.35; }
            .spec { font-size: 12px; font-weight: 700; color: #b3202a; margin-top: 2px; }

            .lh-bar { display: flex; align-items: center; margin-top: 6px; }
            .rule { flex: 1.25; height: 3px; background: #2b2b2b; }

            .addr {
              flex: 1.4;
              background: #1b7fc4;
              color: #fff;
              padding: 5px 10px;
              font-weight: 700;
              font-size: 12px;
            }

            /* ---- Body ---- */
            .body { display: flex; margin-top: 6px; }

            .side {
              flex: none;
              width: 36mm;
              min-height: 170mm;
              padding: 6mm 4mm 0 10mm;
              border-right: 1.5px solid #222;
            }

            .vit { margin-bottom: 8mm; }
            .vit span { display: block; font-size: 13px; }
            .vit b { font-size: 15px; }

            .main { flex: 1; padding: 4mm 10mm 0 8mm; }

            .pt {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 8px;
              padding-bottom: 6px;
              border-bottom: 1px dotted #888;
            }

            .pt-name span, .pt-meta span { color: #555; }
            .pt-name b { font-size: 17px; }
            .pt-name small { display: block; color: #555; }
            .pt-meta div { margin-bottom: 2px; white-space: nowrap; }

            .block { margin: 8px 0; }

            .block h4 {
              margin: 0 0 3px;
              padding-bottom: 2px;
              font-size: 12px;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              color: #1b7fc4;
              border-bottom: 1px solid #cfe0ee;
            }

            .block p { margin: 2px 0; }
            .tk { display: inline-block; margin: 0 14px 2px 0; font-weight: 600; }

            .rx {
              margin-top: 10px;
              font-size: 22px;
              font-weight: 700;
              font-style: italic;
              color: #1b7fc4;
            }

            table.meds { width: 100%; border-collapse: collapse; margin: 4px 0 8px; }
            .meds th, .meds td { border: 1px solid #999; padding: 5px 7px; text-align: left; font-size: 13px; }
            .meds th { background: #e6f1fa; }
            .meds tr { page-break-inside: avoid; }

            .follow { margin: 8px 0; text-align: left; }

            .sign { display: flex; justify-content: flex-end; margin-top: 30mm; }
            .sign div { min-width: 50mm; padding-top: 4px; border-top: 1px solid #777; text-align: center; font-size: 12px; }

            /* ---- Footer ---- */
            .foot { position: absolute; left: 0; right: 0; bottom: 0; }
            .foot .note { padding: 0 10mm 3px; text-align: right; font-weight: 700; font-size: 13px; }
            .foot .band { height: 8mm; background: #1b7fc4; border-top: 2.5mm solid #262626; }
          </style>
        </head>

        <body>
          <div class="page">
            <header class="lh">
              <div class="reg">Reg. No......................</div>
              <img class="organs" src="${LETTERHEAD_ORGANS}" alt="" />
              <h1>${escapeHtml(clinic.name)}</h1>

              <div class="lh-cols">
                <div class="lh-l">
                  <div class="dr">${escapeHtml(clinic.doctor)}</div>
                  <div class="q">${escapeHtml(clinic.qualification)}</div>
                  <div class="s">${clinic.lines.map(escapeHtml).join('<br />')}</div>
                  <div class="ph">☎ ${escapeHtml(clinic.phones)}</div>
                </div>

                <div class="lh-logo">
                  <img src="${LETTERHEAD_LOGO}" alt="" width="56" height="56" />
                </div>

                <div class="lh-r hi">
                  <div class="hi-top">
                    <div class="dr">${escapeHtml(clinic.doctorHindi)}</div>
                    <div class="q">${escapeHtml(clinic.qualification)}</div>
                  </div>
                  <div class="cond">${escapeHtml(clinic.conditionsHindi)}</div>
                  <div class="spec">${escapeHtml(clinic.special)}</div>
                </div>
              </div>

              <div class="lh-bar">
                <div class="rule"></div>
                <div class="addr hi">${escapeHtml(clinic.addressHindi)}</div>
              </div>
            </header>

            <div class="body">
              <aside class="side">${vitalRows}</aside>

              <main class="main">
                <div class="pt">
                  <div class="pt-name">
                    <span>Name</span> <b>${escapeHtml(visit.patientName)}</b>
                    <small>${escapeHtml(visit.patientId)}${has(visit.phone) ? ' · ' + escapeHtml(visit.phone) : ''}</small>
                  </div>

                  <div class="pt-meta">
                    <div><span>Date :</span> ${escapeHtml(visitDate)}</div>
                    <div><span>Age :</span> ${escapeHtml(visit.age)}</div>
                    <div><span>Sex :</span> ${escapeHtml(visit.gender)}</div>
                  </div>
                </div>

                ${symptomsSection}
                ${examSection}
                ${comoSection}
                ${investigationsSection}
                ${diagnosisSection}
                ${medicineSection}
                ${adviceSection}
                ${followUpSection}

                <div class="sign">
                  <div>Doctor's signature</div>
                </div>
              </main>
            </div>

            <footer class="foot">
              <div class="note hi">${escapeHtml(clinic.footerHindi)}</div>
              <div class="band"></div>
            </footer>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 500);
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
    return (
      visit.patientId ||
      visit.phone ||
      `${visit.patientName.toLowerCase()}-${visit.age}`
    );
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

  private emptyExamination(): Examination {
    return {
      anaemia: false,
      jaundice: false,
      clubbing: false,
      cyanosis: false,
      pedalEdema: false,
      lymphNode: false,
      cvs: '',
      rs: '',
      cns: '',
      gi: '',
    };
  }

  private emptyComorbidities(): Comorbidities {
    return {
      htn: false,
      dm: false,
      cad: false,
      cva: false,
      allergy: false,
      atopy: false,
      asthma: false,
      copd: false,
      ild: false,
      drugAllergy: '',
      drugAllergyDetails: '',
      surgicalComplications: '',
      surgicalComplicationsNote: '',
    };
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
      this.comorbidities.drugAllergyDetails =
        visit.comorbidities.drugAllergyDetails || '';
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

    this.labInvestigations =
      visit.labInvestigations || '';

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