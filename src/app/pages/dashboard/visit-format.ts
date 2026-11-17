// Small text helpers used by several parts of the doctor dashboard.
import { Comorbidities, Medicine, Visit, Vitals } from '../../services/visit';

/** Time of the visit in milliseconds (0 when unknown). */
export function visitTime(visit: Visit): number {
  return visit.visitDate ? new Date(visit.visitDate).getTime() : 0;
}

/** One key per patient: patient ID, else phone, else name + age. */
export function patientKey(visit: Visit): string {
  return visit.patientId || visit.phone || `${visit.patientName.toLowerCase()}-${visit.age}`;
}

/** "45M" */
export function ageSex(visit: Visit): string {
  const age = String(visit.age ?? '').trim();
  const sex = String(visit.gender ?? '')
    .trim()
    .charAt(0)
    .toUpperCase();
  return `${age}${sex}`;
}

/** "BP 120/80, SpO2 98, Temp -, ..." */
export function vitalsSummary(vitals?: Partial<Vitals>): string {
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

/** Drug allergy line shown in the form review and the patient history. */
export function allergySummary(visit?: { allergies?: string; comorbidities?: Comorbidities }): string {
  const como = visit?.comorbidities;
  if (como?.drugAllergy === 'Yes') {
    return como.drugAllergyDetails ? `Drug allergy: ${como.drugAllergyDetails}` : 'Drug allergy: Yes';
  }
  if (visit?.allergies) {
    return visit.allergies;
  }
  return como?.drugAllergy === 'No' ? 'No drug allergy' : 'None recorded';
}

/** "1 tablet · 1-0-1 · 5 days · After food" */
export function medicineLine(medicine: Medicine): string {
  return [medicine.dosage, medicine.frequency, medicine.duration, medicine.timing]
    .filter(Boolean)
    .join(' · ');
}

/** Removes empty values and repeats (case-insensitive), keeps the first spelling. */
export function uniqueValues(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = String(value || '').trim();
    const key = cleaned.toLowerCase();
    if (cleaned && !seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }
  return result;
}
