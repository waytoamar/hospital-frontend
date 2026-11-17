// Everything typed in the visit form, plus the rules between the tick boxes.
import { Comorbidities, Examination, Medicine, Visit, VisitStatus, Vitals } from '../../../services/visit';
import {
  COMORBIDITY_CHECKS,
  ComorbidityKey,
  EXAM_CHECKS,
  ExamCheckKey,
  YesNoField,
} from './visit-form.options';

/** "Others" tick + a free-text note, on top of the saved Examination / Comorbidities */
export type ExamForm = Examination & { others: boolean; othersNote: string };
export type ComorbidityForm = Comorbidities & { others: boolean; othersNote: string };

export class VisitFormData {
  patientId = '';
  phone = '';
  patientName = '';
  age = '';
  gender = '';
  disease = '';
  symptoms = '';
  diagnosis = '';
  allergies = '';
  vitals: Vitals = emptyVitals();
  examination: ExamForm = emptyExamination();
  comorbidities: ComorbidityForm = emptyComorbidities();
  labInvestigations = '';
  comments = '';
  medicines: Medicine[] = [emptyMedicine()];
  followUpDate = '';
  status: VisitStatus = 'Waiting';

  /** Name, age, gender and a 10-digit phone are required. */
  get patientValid(): boolean {
    return (
      !!this.patientName.trim() && /^\d{1,3}$/.test(this.age) && !!this.gender && /^\d{10}$/.test(this.phone)
    );
  }

  get hasData(): boolean {
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
        Object.values(this.vitals).some(Boolean) ||
        Object.values(this.examination).some(Boolean) ||
        Object.values(this.comorbidities).some(Boolean) ||
        this.medicines.some((medicine) => medicine.name.trim()),
    );
  }

  /** Name, phone, age, gender and a known drug allergy of a patient seen before. */
  fillPatient(visit: Visit): void {
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

  /** Everything of a saved visit (edit) or of a draft. */
  fillAll(visit: Partial<Visit>): void {
    this.fillPatient({
      ...visit,
      phone: visit.phone || '',
      patientName: visit.patientName || '',
      age: visit.age || '',
      gender: visit.gender || '',
    } as Visit);
    this.disease = visit.disease || '';
    this.symptoms = visit.symptoms || '';
    this.diagnosis = visit.diagnosis || '';
    this.vitals = { ...emptyVitals(), ...(visit.vitals || {}) };
    this.examination = { ...emptyExamination(), ...(visit.examination || {}) };
    this.comorbidities = { ...emptyComorbidities(), ...(visit.comorbidities || {}) };
    this.labInvestigations = visit.labInvestigations || '';
    this.comments = visit.comments || '';
    this.medicines = copyMedicines(visit.medicines);
    this.followUpDate = visit.followUpDate || '';
    this.status = visit.status || 'Waiting';
  }

  /** Same patient's last visit: disease, diagnosis, comorbidities and medicines. */
  copyFromLastVisit(last: Visit): void {
    this.disease = last.disease || '';
    this.diagnosis = last.diagnosis || '';
    this.comorbidities = { ...emptyComorbidities(), ...(last.comorbidities || {}) };
    this.medicines = copyMedicines(last.medicines);
  }

  /** The visit to send to the server. */
  toVisit(): Visit {
    return {
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
      medicines: this.medicines.filter((medicine) => medicine.name.trim()),
      followUpDate: this.followUpDate || undefined,
      status: this.status,
    };
  }

  /** Plain copy of the form for the auto-saved draft. */
  toDraft(): Partial<Visit> {
    return {
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
    };
  }

  // ---- Tick boxes ----

  /** "Nil significant" unticks every finding; any finding unticks "Nil significant". */
  toggleExam(key: ExamCheckKey): void {
    const turningOn = !this.examination[key];
    if (key === 'nilSignificant' && turningOn) {
      EXAM_CHECKS.forEach((item) => (this.examination[item.key] = false));
      this.examination.othersNote = '';
      this.examination.nilSignificant = true;
      return;
    }
    this.examination[key] = turningOn;
    if (turningOn) {
      this.examination.nilSignificant = false;
    }
    if (key === 'others' && !turningOn) {
      this.examination.othersNote = '';
    }
  }

  /** "Nil" unticks every comorbidity; any comorbidity unticks "Nil". */
  toggleComorbidity(key: ComorbidityKey): void {
    const turningOn = !this.comorbidities[key];
    if (key === 'nil' && turningOn) {
      COMORBIDITY_CHECKS.forEach((item) => (this.comorbidities[item.key] = false));
      this.comorbidities.othersNote = '';
      this.comorbidities.nil = true;
      return;
    }
    this.comorbidities[key] = turningOn;
    if (turningOn) {
      this.comorbidities.nil = false;
    }
    if (key === 'others' && !turningOn) {
      this.comorbidities.othersNote = '';
    }
  }

  /** Clicking the chosen answer again clears it. */
  setYesNo(field: YesNoField, value: 'Yes' | 'No'): void {
    this.comorbidities[field] = this.comorbidities[field] === value ? '' : value;
    if (this.comorbidities.drugAllergy !== 'Yes') {
      this.comorbidities.drugAllergyDetails = '';
    }
    if (!this.comorbidities.surgicalComplications) {
      this.comorbidities.surgicalComplicationsNote = '';
    }
  }

  // ---- Medicines ----

  addMedicine(): void {
    this.medicines.push(emptyMedicine());
  }

  removeMedicine(index: number): void {
    this.medicines.splice(index, 1);
    if (!this.medicines.length) {
      this.medicines.push(emptyMedicine());
    }
  }
}

export function emptyMedicine(): Medicine {
  return { name: '', dosage: '', frequency: '', duration: '', timing: '' };
}

function copyMedicines(medicines?: Medicine[]): Medicine[] {
  return medicines?.length
    ? medicines.map((medicine) => ({ ...emptyMedicine(), ...medicine }))
    : [emptyMedicine()];
}

function emptyVitals(): Vitals {
  return { bloodPressure: '', spo2: '', temperature: '', bloodSugar: '', weight: '', heartRate: '' };
}

function emptyExamination(): ExamForm {
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

function emptyComorbidities(): ComorbidityForm {
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
