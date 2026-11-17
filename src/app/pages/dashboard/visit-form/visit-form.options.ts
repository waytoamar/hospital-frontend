// Fixed choices shown in the visit form.
import { VisitStatus } from '../../../services/visit';

export type ExamCheckKey =
  | 'anaemia'
  | 'jaundice'
  | 'clubbing'
  | 'cyanosis'
  | 'pedalEdema'
  | 'lymphNode'
  | 'nilSignificant'
  | 'others';

export type ExamNoteKey = 'cvs' | 'rs' | 'cns' | 'gi';

export type ComorbidityKey =
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

export type YesNoField = 'drugAllergy' | 'surgicalComplications' | 'smoker' | 'alcoholic';

export const FORM_STEPS = ['Patient', 'Clinical notes', 'Medicines', 'Review'] as const;

export const EXAM_CHECKS: { key: ExamCheckKey; label: string }[] = [
  { key: 'anaemia', label: 'Anaemia' },
  { key: 'jaundice', label: 'Jaundice' },
  { key: 'clubbing', label: 'Clubbing' },
  { key: 'cyanosis', label: 'Cyanosis' },
  { key: 'pedalEdema', label: 'Pedal edema' },
  { key: 'lymphNode', label: 'Lymph node' },
  { key: 'nilSignificant', label: 'Nil significant' },
  { key: 'others', label: 'Others' },
];

export const EXAM_NOTES: { key: ExamNoteKey; label: string }[] = [
  { key: 'cvs', label: 'CVS' },
  { key: 'rs', label: 'RS' },
  { key: 'cns', label: 'CNS' },
  { key: 'gi', label: 'GI' },
];

export const COMORBIDITY_CHECKS: { key: ComorbidityKey; label: string }[] = [
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

export const YES_NO_QUESTIONS: { field: YesNoField; label: string }[] = [
  { field: 'drugAllergy', label: 'Drug allergy' },
  { field: 'surgicalComplications', label: 'Previous surgical complications' },
  { field: 'smoker', label: 'Smoker' },
  { field: 'alcoholic', label: 'Alcoholic' },
];

export const VISIT_STATUSES: VisitStatus[] = [
  'Waiting',
  'In consultation',
  'Lab investigation',
  'Completed',
  'No show',
];

export const DOSAGE_OPTIONS = [
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
  'Nasal Spray',
  'Eye Drops',
  'Ear Drops',
  'Nasal Drops',
  'Cream / Gel',
  'Sachet',
  'Rotacap',
];

export const FREQUENCY_OPTIONS = [
  '1-0-0',
  '0-1-0',
  '0-0-1',
  '1-0-1',
  '1-1-1',
  '0-1-1',
  '1-1-0',
  '2-0-2',
  '0-0-2',
  'OD',
  'BD',
  'TDS',
  'SOS',
];

export const TIMING_OPTIONS = [
  'Food timing',
  'Morning empty stomach',
  'Before Breakfast',
  '30 mins before food',
  '1hr Before food',
  'Before food',
  'Empty stomach',
  'With food',
  'After breakfast',
  'After lunch',
  'After dinner',
  'After food',
  'Not related to food',
  'At bedtime',
  'Once a week',
  'As directed',
];
