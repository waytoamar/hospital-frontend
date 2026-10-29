import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService, Role, homeFor } from '../../services/auth';

interface RoleCard {
  role: Role;
  title: string;
  text: string;
  action: string; // link text at the bottom of the card
  loginPath: string;
  tone: 'green' | 'blue' | 'red' | 'purple';
}

// Staff portal: "Who is signing in?" (/welcome)
@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrl: './welcome.css',
  templateUrl: './welcome.html',
})
export class Welcome implements OnInit {
  signedInAs: Role | null = null;

  readonly cards: RoleCard[] = [
    {
      role: 'doctor',
      title: 'Doctor',
      text: 'Consult patients, write prescriptions and review history.',
      action: 'Sign in',
      loginPath: '/login',
      tone: 'green',
    },
    {
      role: 'receptionist',
      title: 'Receptionist',
      text: 'Register patients and manage the daily queue.',
      action: 'Open desk',
      loginPath: '/pin/receptionist',
      tone: 'blue',
    },
    {
      role: 'pharmacist',
      title: 'Pharmacist',
      text: 'Find and print prescriptions for dispensing.',
      action: 'Open pharmacy',
      loginPath: '/pin/pharmacist',
      tone: 'red',
    },
    {
      role: 'lab',
      title: 'Lab',
      text: 'Enter test results and upload reports.',
      action: 'Open lab',
      loginPath: '/pin/lab',
      tone: 'purple',
    },
  ];

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
  open(card: RoleCard): void {
    this.router.navigate([this.signedInAs === card.role ? homeFor(card.role) : card.loginPath]);
  }
}
