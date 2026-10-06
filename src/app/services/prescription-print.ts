import { Visit } from './visit';
import { LETTERHEAD_LOGO, LETTERHEAD_ORGANS } from '../components/dashboard/letterhead-images';

const EXAM_CHECKS = [
  { key: 'anaemia', label: 'Anaemia' },
  { key: 'jaundice', label: 'Jaundice' },
  { key: 'clubbing', label: 'Clubbing' },
  { key: 'cyanosis', label: 'Cyanosis' },
  { key: 'pedalEdema', label: 'Pedal edema' },
  { key: 'lymphNode', label: 'Lymph node' },
] as const;

const EXAM_NOTES = [
  { key: 'cvs', label: 'CVS' },
  { key: 'rs', label: 'RS' },
  { key: 'cns', label: 'CNS' },
  { key: 'gi', label: 'GI' },
] as const;

const COMORBIDITY_CHECKS = [
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
] as const;

// "Others" tick + free text (added on top of the shared Visit types)
type WithOthers = { others?: boolean; othersNote?: string };

// ---- Pre-printed letterhead paper ----
// When the clinic prints on paper that already has the header, the digital header is not
// printed. An empty gap is left instead, so the prescription starts BELOW the printed header.
// Change PREPRINTED_TOP_SPACE_MM if the text starts too high or too low on your paper.
const PREPRINTED_KEY = 'print-on-preprinted-paper';
const PREPRINTED_TOP_SPACE_MM = 60;
const PREPRINTED_HIDE_FOOTER = false; // true: also skip the bottom band + Hindi note

export function isPreprintedPaper(): boolean {
  try {
    return localStorage.getItem(PREPRINTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPreprintedPaper(on: boolean): void {
  try {
    if (on) {
      localStorage.setItem(PREPRINTED_KEY, '1');
    } else {
      localStorage.removeItem(PREPRINTED_KEY);
    }
  } catch {
    // storage blocked: the normal header will print
  }
}

export function printPrescription(visit: Visit): void {
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

  const has = (value: unknown): boolean => String(value || '').trim().length > 0;

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
    doctor: 'Dr. Mahesh',
    qualification: 'MBBS, DNB (PULMONOLOGY)',
    lines: [
      'FELLOWSHIP IN RESPIRATORY ICU',
      'INTENSIVIST SLEEP SPECIALIST',
      'ALLERGY SPECIALIST, INTERVENTIONAL PULMONOLOGIST',
      '(ASSIST. PROFESSOR DEPT. OF PULMONARY MEDICINE CIMS CWA',
      'EX. CONSULTANT WCL HOSPITAL BARKUHI)',
    ],
    phones: '8109838316, 8817483758',
    doctorHindi: 'डॉ. महेश',
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
      ([label, value]) => `<div class="vit"><span>${label}</span><b>${escapeHtml(value)}</b></div>`,
    )
    .join('');

  const section = (title: string, body: string): string =>
    body ? `<div class="block"><h4>${title}</h4>${body}</div>` : '';

  const ticks = (labels: string[]): string =>
    labels.length
      ? `<p>${labels.map((label) => `<span class="tk">✓ ${escapeHtml(label)}</span>`).join('')}</p>`
      : '';

  // ---- Symptoms ----
  const symptomsSection = section(
    'Symptoms',
    has(visit.symptoms) ? `<p>${escapeHtml(visit.symptoms)}</p>` : '',
  );

  // ---- Clinical examination: ticked items + written findings only ----
  const exam = visit.examination as (Visit['examination'] & WithOthers) | undefined;
  const examTicked: string[] = EXAM_CHECKS.filter((item) => exam?.[item.key]).map(
    (item) => item.label,
  );
  // what the doctor wrote under "Others" prints in the same row as the ticked findings
  if (exam?.others && has(exam.othersNote)) {
    examTicked.push(String(exam.othersNote).trim());
  }
  const examFindings = EXAM_NOTES.filter((item) => has(exam?.[item.key]))
    .map((item) => `<p><b>${item.label}:</b> ${escapeHtml(exam?.[item.key])}</p>`)
    .join('');
  const examSection = section('Clinical Examination', ticks(examTicked) + examFindings);

  // ---- Comorbidities: ticked items + answered Yes/No only ----
  const como = visit.comorbidities as (Visit['comorbidities'] & WithOthers) | undefined;
  const comoTicked: string[] = COMORBIDITY_CHECKS.filter((item) => como?.[item.key]).map(
    (item) => item.label,
  );
  // what the doctor wrote under "Others" prints in the same row as the ticked items
  if (como?.others && has(como.othersNote)) {
    comoTicked.push(String(como.othersNote).trim());
  }

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

  if (como?.smoker) {
    comoLines.push(`<p><b>Smoker:</b> ${como.smoker}</p>`);
  }
  if (como?.alcoholic) {
    comoLines.push(`<p><b>Alcoholic:</b> ${como.alcoholic}</p>`);
  }

  const comoSection = section('Comorbidities', ticks(comoTicked) + comoLines.join(''));

  // Investigations are NOT printed: the lab gives its own printed reports to attach.

  // ---- Diagnosis ----
  const diagnosisSection = section(
    'Diagnosis',
    (has(visit.disease) ? `<p><b>Disease:</b> ${escapeHtml(visit.disease)}</p>` : '') +
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

  const preprinted = isPreprintedPaper();

  const visitDate = visit.visitDate ? new Date(visit.visitDate).toLocaleDateString('en-IN') : '';

  const printWindow = window.open('', '_blank', 'width=900,height=900');

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
              width: 210mm;
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

            .sign { display: flex; justify-content: flex-end; margin-top: 22mm; }
            .sign div { min-width: 50mm; padding-top: 4px; border-top: 1px solid #777; text-align: center; font-size: 12px; }

            /* ---- Footer ---- */
            .foot { position: absolute; left: 0; right: 0; bottom: 0; }
            .foot .note { padding: 0 10mm 3px; text-align: right; font-weight: 700; font-size: 13px; }
            .foot .band { height: 8mm; background: #1b7fc4; border-top: 2.5mm solid #262626; }
          </style>
        </head>

        <body>
          <div class="page">
            ${preprinted ? `<div style="height:${PREPRINTED_TOP_SPACE_MM}mm"></div>` : ''}
            <header class="lh" ${preprinted ? 'hidden style="display:none"' : ''}>
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
                ${diagnosisSection}
                ${medicineSection}
                ${adviceSection}
                ${followUpSection}

                <div class="sign">
                  <div>Doctor's signature</div>
                </div>
              </main>
            </div>

            <footer class="foot" ${preprinted && PREPRINTED_HIDE_FOOTER ? 'hidden style="display:none"' : ''}>
              <div class="note hi">${escapeHtml(clinic.footerHindi)}</div>
              <div class="band"></div>
            </footer>
          </div>
        </body>
      </html>
    `);

  printWindow.document.close();

  setTimeout(() => {
    // Shrink the text area a little (only if needed) so everything fits on ONE A4 page
    const page = printWindow.document.querySelector('.page') as HTMLElement | null;
    const main = printWindow.document.querySelector('.main') as HTMLElement | null;
    if (page && main) {
      const maxHeight = (296 / 25.4) * 96; // 296 mm in CSS pixels
      let zoom = 1;
      while (page.getBoundingClientRect().height > maxHeight && zoom > 0.5) {
        zoom = Math.round((zoom - 0.02) * 100) / 100;
        main.style.setProperty('zoom', String(zoom));
      }
    }
    printWindow.print();
  }, 500);
}