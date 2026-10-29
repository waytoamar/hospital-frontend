import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, Role, homeFor } from '../../services/auth';

@Component({
  selector: 'app-pin-login',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrl: '../staff-shared.css',
  templateUrl: './pin-login.html',
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
