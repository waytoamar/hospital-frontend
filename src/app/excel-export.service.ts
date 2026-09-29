import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx-js-style';
import { Visit } from './services/visit';

@Injectable({
  providedIn: 'root',
})
export class ExcelExportService {
  exportVisits(
    visits: Visit[],
    fileName = 'visits.xlsx'
  ): void {
    const headers = [
      'Patient ID',
      'Patient Name',
      'Phone',
      'Age',
      'Gender',
      'Disease',
      'Symptoms',
      'Diagnosis',
      'Allergies',
      'BP',
      'Temperature',
      'Weight',
      'Blood Sugar',
      'Lab Investigations',
      'Medicines',
      'Follow-up',
      'Status',
      'Comments',
      'Visit Date',
    ];

    const rows = visits.map((visit) => [
      visit.patientId || '',
      visit.patientName,
      visit.phone,
      visit.age,
      visit.gender,
      visit.disease,
      visit.symptoms,
      visit.diagnosis,
      visit.allergies,
      visit.vitals?.bloodPressure || '',
      visit.vitals?.temperature || '',
      visit.vitals?.weight || '',
      visit.vitals?.bloodSugar || '',
      visit.labInvestigations || '',
      (visit.medicines || [])
        .map(
          (medicine) =>
            `${medicine.name} | ${medicine.dosage} | ` +
            `${medicine.frequency} | ${medicine.duration} | ` +
            `${medicine.timing}`
        )
        .join('\n'),
      visit.followUpDate || '',
      visit.status,
      visit.comments || '',
      visit.visitDate
        ? new Date(visit.visitDate).toLocaleDateString('en-IN')
        : '',
    ]);

    const worksheet =
      XLSX.utils.aoa_to_sheet([headers, ...rows]);

    const widths = [
      14, 20, 14, 6, 9, 18, 24, 24, 20, 12,
      12, 10, 12, 24, 48, 14, 18, 25, 14,
    ];

    worksheet['!cols'] = widths.map((width) => ({
      wch: width,
    }));

    const range = XLSX.utils.decode_range(
      worksheet['!ref'] || 'A1'
    );

    for (
      let row = range.s.r;
      row <= range.e.r;
      row++
    ) {
      for (
        let column = range.s.c;
        column <= range.e.c;
        column++
      ) {
        const address = XLSX.utils.encode_cell({
          r: row,
          c: column,
        });

        const cell = worksheet[address];

        if (!cell) {
          continue;
        }

        cell.s = {
          alignment: {
            wrapText: true,
            vertical: 'top',
          },
          ...(row === 0
            ? {
                font: {
                  bold: true,
                  color: {
                    rgb: 'FFFFFF',
                  },
                },
                fill: {
                  fgColor: {
                    rgb: '287A4B',
                  },
                },
              }
            : {}),
        };
      }
    }

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Visits'
    );

    XLSX.writeFile(workbook, fileName);
  }
}
