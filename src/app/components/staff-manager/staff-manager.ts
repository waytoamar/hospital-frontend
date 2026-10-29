import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StaffAdminService, StaffMember, StaffRole } from '../../services/staff-admin';

const ROLE_TITLES: Record<StaffRole, string> = {
  receptionist: 'Receptionists',
  pharmacist: 'Pharmacists',
  lab: 'Lab assistants',
};

@Component({
  selector: 'app-staff-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: '../staff-shared.css',
  templateUrl: './staff-manager.html',
})
export class StaffManager implements OnInit {
  people: StaffMember[] = [];

  newName = '';
  newRole: StaffRole = 'receptionist';
  newPin = '';
  addError = '';

  editing = '';
  editName = '';
  editPin = '';
  editError = '';

  error = '';
  busy = false;

  constructor(
    private api: StaffAdminService,
    private router: Router,
  ) {}

  get groups(): { title: string; people: StaffMember[] }[] {
    return (Object.keys(ROLE_TITLES) as StaffRole[]).map((role) => ({
      title: ROLE_TITLES[role],
      people: this.people.filter((person) => person.role === role),
    }));
  }

  ngOnInit(): void {
    this.load();
  }

  trackById = (_: number, person: StaffMember) => person._id;

  digits(value: string): string {
    return String(value || '')
      .replace(/\D/g, '')
      .slice(0, 4);
  }

  back(): void {
    this.router.navigate(['/dashboard']);
  }

  private load(): void {
    this.api.list().subscribe({
      next: (people) => {
        this.people = people;
        this.error = '';
      },
      error: (err) => {
        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/login']);
          return;
        }
        this.error = 'Could not load staff. Please try again.';
      },
    });
  }

  add(): void {
    this.addError = '';
    if (!this.newName.trim()) {
      this.addError = "Enter the person's name";
      return;
    }
    if (!/^\d{4}$/.test(this.newPin)) {
      this.addError = 'PIN must be exactly 4 digits';
      return;
    }

    this.busy = true;
    this.api.add(this.newName.trim(), this.newRole, this.newPin).subscribe({
      next: () => {
        this.busy = false;
        this.newName = '';
        this.newPin = '';
        this.load();
      },
      error: (err) => {
        this.busy = false;
        this.addError = err?.error?.message || 'Could not add. Please try again.';
      },
    });
  }

  startEdit(person: StaffMember): void {
    this.editing = person._id;
    this.editName = person.name;
    this.editPin = '';
    this.editError = '';
  }

  saveEdit(person: StaffMember): void {
    this.editError = '';
    const changes: { name?: string; pin?: string } = {};

    if (this.editName.trim() && this.editName.trim() !== person.name) {
      changes['name'] = this.editName.trim();
    }
    if (this.editPin) {
      if (!/^\d{4}$/.test(this.editPin)) {
        this.editError = 'PIN must be exactly 4 digits';
        return;
      }
      changes['pin'] = this.editPin;
    }
    if (!changes.name && !changes.pin) {
      this.editing = '';
      return;
    }

    this.busy = true;
    this.api.update(person._id, changes).subscribe({
      next: () => {
        this.busy = false;
        this.editing = '';
        this.load();
      },
      error: (err) => {
        this.busy = false;
        this.editError = err?.error?.message || 'Could not save. Please try again.';
      },
    });
  }

  remove(person: StaffMember): void {
    if (!window.confirm(`Remove ${person.name}? They will be signed out immediately.`)) {
      return;
    }
    this.api.remove(person._id).subscribe({
      next: () => this.load(),
      error: () => (this.error = 'Could not remove. Please try again.'),
    });
  }
}