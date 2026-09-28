import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx-js-style';
import { Visit, Medicine } from './services/visit';

@Injectable({ providedIn: 'root' })
export class ExcelExportService {

  // Medicines ni okati okati line lo pettadaniki
  private formatMedicines(medicines: Medicine[]): string {
    return (medicines || [])
      .map(m => `${m.name} - ${m.dosage} - ${m.timing}`)
      .join('\n');
  }

  exportVisits(visits: Visit[], fileName = 'visits.xlsx') {
    const headers = [
      'Patient Name', 'Age', 'Gender', 'Disease', 'Symptoms',
      'Diagnosis', 'Lab Investigations', 'Medicines', 'Comments', 'Visit Date',
    ];

    const rows = visits.map(v => [
      v.patientName,
      v.age,
      v.gender,
      v.disease,
      v.symptoms,
      v.diagnosis,
      v.labInvestigations ?? '',
      this.formatMedicines(v.medicines),
      v.comments ?? '',
      v.visitDate ? new Date(v.visitDate).toLocaleDateString('en-IN') : '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths
    ws['!cols'] = [
      { wch: 20 }, { wch: 6 }, { wch: 8 }, { wch: 18 }, { wch: 25 },
      { wch: 25 }, { wch: 25 }, { wch: 45 }, { wch: 25 }, { wch: 14 },
    ];

    // Anni cells ki wrap text + top align, header ki bold
    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        ws[addr].s = {
          alignment: { wrapText: true, vertical: 'top' },
          ...(r === 0 ? { font: { bold: true } } : {}),
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visits');
    XLSX.writeFile(wb, fileName);
  }
}