import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, Role, homeFor } from '../../services/auth';

@Component({
  selector: 'app-pin-login',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrl: '../staff-shared.css',
  template: `
    <div class="center-page">
      <div class="pin-card">
        <img class="logo-img" src="lungs.jpg" alt="Chest & Allergy Clinic" />
        <h1 class="title">{{ roleTitle }}</h1>
        <p class="sub">Enter your 4-digit PIN</p>

        <div class="dots">
          <span *ngFor="let i of [0, 1, 2, 3]" [class.on]="i < pin.length"></span>
        </div>
        <p class="error" *ngIf="error">{{ error }}</p>

        <div class="pad">
          <button
            *ngFor="let key of keys"
            class="key"
            [class.blank]="key === ''"
            [disabled]="busy || key === ''"
            (click)="press(key)"
          >
            {{ key }}
          </button>
        </div>

        <a class="link" routerLink="/welcome">← Back</a>
      </div>
    </div>
  `,
})
export class PinLogin {
  // 1. Role టైప్‌కు 'lab' జోడించబడింది
  role: Exclude<Role, 'doctor'> = 'receptionist';
  pin = '';
  error = '';
  busy = false;
  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  constructor(
    route: ActivatedRoute,
    private auth: AuthService,
    private router: Router,
  ) {
    const roleParam = route.snapshot.paramMap.get('role');
    // 2. Route Params తనిఖీలో 'lab' ని చేర్చాం
    if (roleParam === 'receptionist' || roleParam === 'pharmacist' || roleParam === 'lab') {
      this.role = roleParam;
    } else {
      this.router.navigate(['/welcome']);
    }
  }

  // 3. UI టైటిల్ ప్రదర్శించడానికి హెల్పర్ గెట్టర్
  get roleTitle(): string {
    if (this.role === 'receptionist') return 'Receptionist';
    if (this.role === 'pharmacist') return 'Pharmacist';
    if (this.role === 'lab') return 'Lab Technician';
    return '';
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (/^\d$/.test(event.key)) this.press(event.key);
    else if (event.key === 'Backspace') this.press('⌫');
  }

  press(key: string): void {
    if (this.busy) return;
    if (key === '⌫') {
      this.pin = this.pin.slice(0, -1);
      return;
    }
    if (this.pin.length >= 4) return;
    this.pin += key;
    this.error = '';
    if (this.pin.length === 4) this.submit();
  }

  private submit(): void {
    this.busy = true;
    this.auth.pinLogin(this.role, this.pin).subscribe({
      next: () => this.router.navigate([homeFor(this.role)]),
      error: (err) => {
        this.busy = false;
        this.pin = '';
        this.error = err?.error?.message || 'Could not sign in. Please try again.';
      },
    });
  }
}
