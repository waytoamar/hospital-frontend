import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, Role, homeFor } from '../../services/auth';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  styleUrl: '../staff-shared.css',
  template: `
    <div class="center-page">
      <img class="logo-img big" src="lungs.jpg" alt="Chest & Allergy Clinic" />
      <h1 class="hero">Chest &amp; Allergy Clinic</h1>
      <p class="sub">Who is signing in?</p>

      <div class="role-cards">
        <button class="role-card" (click)="open('doctor', '/login')">
          <span class="icon">🩺</span>
          <b>Doctor</b>
          <small>{{
            signedInAs === 'doctor' ? 'Signed in · tap to continue' : 'Username & password'
          }}</small>
        </button>

        <button class="role-card" (click)="open('receptionist', '/pin/receptionist')">
          <span class="icon">📋</span>
          <b>Receptionist</b>
          <small>{{
            signedInAs === 'receptionist'
              ? 'Signed in · tap to continue'
              : 'Register patients & manage queue'
          }}</small>
        </button>

        <button class="role-card" (click)="open('pharmacist', '/pin/pharmacist')">
          <span class="icon">💊</span>
          <b>Pharmacist</b>
          <small>{{
            signedInAs === 'pharmacist'
              ? 'Signed in · tap to continue'
              : 'Find & print prescriptions'
          }}</small>
        </button>

        <button class="role-card" (click)="open('lab', '/pin/lab')">
          <span class="icon">🧪</span>
          <b>Lab</b>
          <small>{{
            signedInAs === 'lab' ? 'Signed in · tap to continue' : 'Enter test results & reports'
          }}</small>
        </button>
      </div>
    </div>
  `,
})
export class Welcome implements OnInit {
  signedInAs: Role | null = null;

  constructor(
    private router: Router,
    private auth: AuthService,
  ) {}

  // Only checks who is signed in. It never redirects, so all four cards always show.
  ngOnInit(): void {
    this.auth.me().subscribe({
      next: () => (this.signedInAs = this.auth.getRole()),
      error: () => (this.signedInAs = null),
    });
  }

  // Already signed in as that role: go straight in. Otherwise: go to its login.
  open(role: Role, loginPath: string): void {
    this.router.navigate([this.signedInAs === role ? homeFor(role) : loginPath]);
  }
}
