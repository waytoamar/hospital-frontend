import { Visit } from '../../services/visit';

// Screens of the doctor dashboard (left menu)
export type DashboardView = 'board' | 'patients' | 'records' | 'holidays';

// Board columns and the filter chips above them
export type BoardFilter = 'all' | 'waiting' | 'consult' | 'lab' | 'followup' | 'done';
export type PanelKey = Exclude<BoardFilter, 'all'>;

export interface BoardPanel {
  key: PanelKey;
  label: string;
  note: string;
  empty: string;
  visits: Visit[];
}

// What the visit form should open with
export interface VisitFormRequest {
  mode: 'new' | 'edit';
  visit?: Visit; // edit: the visit; new: the patient to start a new visit for (optional)
}

// Fields whose earlier values are offered as suggestions in the visit form
export type PastValueField =
  | 'symptoms'
  | 'comments'
  | 'labInvestigations'
  | 'disease'
  | 'cvs'
  | 'rs'
  | 'cns'
  | 'gi'
  | 'drugAllergyDetails'
  | 'surgicalComplicationsNote'
  | 'medicineName'
  | 'medicineDuration';
