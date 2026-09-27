import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { VisitService, Visit, Medicine } from '../../services/visit';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  patientName = '';
  age = '';
  gender = '';
  disease = '';
  symptoms = '';
  diagnosis = '';
  medicines: Medicine[] = [];

  // Dosage మరియు Timing dropdown ఆప్షన్స్
  dosageOptions: string[] = ['1-0-0', '0-1-0', '0-0-1', '1-1-1', '1-0-1'];
  timingOptions: string[] = ['Before Food (B/F)', 'After Food (A/F)', 'Empty Stomach'];

  editingId: string | null = null;

    activeView: 'board' | 'records' = 'board';

  switchView(view: 'board' | 'records'): void {
    this.activeView = view;
  }
  

  visits: Visit[] = [];
  filterDate: string = '';

  constructor(
    private authService: AuthService,
    private visitService: VisitService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadVisits();
  }

  get username(): string | null {
    return this.authService.getUsername();
  }

  get totalVisitsCount(): number {
    return this.visits.length;
  }

  get todayVisitsCount(): number {
    const today = new Date().toDateString();
    return this.visits.filter(
      (v) => v.visitDate && new Date(v.visitDate).toDateString() === today
    ).length;
  }

    get totalMedicinesCount(): number {
    return this.visits.reduce((sum, v) => sum + (v.medicines?.length || 0), 0);
  }

logout(): void {
  this.authService.logout().subscribe({
    next: () => this.router.navigate(['/login']),
    error: () => this.router.navigate(['/login']),
  });
}


  addMedicineRow(): void {
    this.medicines.push({ name: '', dosage: '', timing: '' });
  }

  removeMedicineRow(index: number): void {
    this.medicines.splice(index, 1);
  }

    resetForm(): void {
    this.patientName = '';
    this.age = '';
    this.gender = '';
    this.disease = '';
    this.symptoms = '';
    this.diagnosis = '';
    this.medicines = [];
    this.editingId = null;

    // Board view లో ఉండేలా చేసి, ఫారమ్ దగ్గరికి scroll చేయడం
    this.activeView = 'board';
    setTimeout(() => {
      const nameInput = document.getElementById('patientNameInput');
      if (nameInput) {
        nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (nameInput as HTMLInputElement).focus();
      }
    }, 50);
  }

loadVisits(): void {
  this.visitService.getVisits(this.filterDate || undefined).subscribe({
    next: (visits) => {
      this.visits = visits;
    },
    error: (error) => {
      if (error.status === 401) {
        this.router.navigate(['/login']);
      } else {
        alert('Visits could not be loaded. Please try again.');
      }
    },
  });
}


  onFilterChange(): void {
    this.loadVisits();
  }

  clearFilter(): void {
    this.filterDate = '';
    this.loadVisits();
  }

  saveVisit(): void {
    if (!this.patientName || !this.age || !this.gender) {
      alert('Please fill Patient Name, Age and Gender');
      return;
    }

    const data: Visit = {
      patientName: this.patientName,
      age: this.age,
      gender: this.gender,
      disease: this.disease,
      symptoms: this.symptoms,
      diagnosis: this.diagnosis,
      medicines: this.medicines,
    };

    if (this.editingId) {
      this.visitService.updateVisit(this.editingId, data).subscribe(() => {
        this.resetForm();
        this.loadVisits();
      });
    } else {
      this.visitService.addVisit(data).subscribe(() => {
        this.resetForm();
        this.loadVisits();
      });
    }
  }

  editVisit(visit: Visit): void {
    this.editingId = visit._id || null;
    this.patientName = visit.patientName;
    this.age = visit.age;
    this.gender = visit.gender;
    this.disease = visit.disease;
    this.symptoms = visit.symptoms;
    this.diagnosis = visit.diagnosis;
    this.medicines = JSON.parse(JSON.stringify(visit.medicines || []));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteVisit(id: string | undefined): void {
    if (!id) return;
    if (!confirm('Delete this visit record?')) return;
    this.visitService.deleteVisit(id).subscribe(() => {
      this.loadVisits();
    });
  }

  printVisit(visit: Visit): void {
    const medRows = (visit.medicines || [])
      .map(
        (m, i) => `
        <tr>
          <td style="padding:6px;border:1px solid #ccc;">${i + 1}</td>
          <td style="padding:6px;border:1px solid #ccc;">${m.name}</td>
          <td style="padding:6px;border:1px solid #ccc;">${m.dosage}</td>
          <td style="padding:6px;border:1px solid #ccc;">${m.timing}</td>
        </tr>`
      )
      .join('');

    const dateStr = visit.visitDate ? new Date(visit.visitDate).toDateString() : '';

    const content = `
      <html>
      <head>
        <title>Prescription</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; }
          h1 { text-align:center; color:#0a7075; margin-bottom:0; }
          .sub { text-align:center; color:#555; margin-top:4px; margin-bottom:24px; }
          .row { display:flex; justify-content:space-between; margin-bottom:6px; }
          .label { font-weight:bold; }
          hr { margin:16px 0; }
          table { width:100%; border-collapse: collapse; margin-top:10px; }
          th { background:#f0f0f0; padding:6px; border:1px solid #ccc; text-align:left; }
        </style>
      </head>
      <body>
        <h1>Prescription</h1>
        <p class="sub">Patient Visit Record</p>
        <hr />
        <div class="row"><span class="label">Patient:</span><span>${visit.patientName} (${visit.age}, ${visit.gender})</span></div>
        <div class="row"><span class="label">Date:</span><span>${dateStr}</span></div>
        <hr />
        <div class="row"><span class="label">Disease:</span><span>${visit.disease || '-'}</span></div>
        <div class="row"><span class="label">Symptoms:</span><span>${visit.symptoms || '-'}</span></div>
        <div class="row"><span class="label">Diagnosis:</span><span>${visit.diagnosis || '-'}</span></div>
        <hr />
        <p class="label">Medicines:</p>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Dosage</th><th>Timing</th></tr></thead>
          <tbody>${medRows || '<tr><td colspan="4" style="padding:6px;border:1px solid #ccc;">No medicines</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `;

    const w = window.open('', '_blank', 'width=800,height=900');
    if (w) {
      w.document.write(content);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    }
  }
}