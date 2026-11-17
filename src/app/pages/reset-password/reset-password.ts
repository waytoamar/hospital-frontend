import { API_BASE } from '../../services/api';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: '../../shared/styles/auth-card.css',
})
export class ResetPassword implements OnInit {
  form: FormGroup;
  token = '';
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.errorMessage = 'This reset link is not valid. Please use "Forgot password" again.';
    }
  }

  submit(): void {
    if (this.form.invalid || this.loading || !this.token) {
      return;
    }

    const { newPassword, confirmPassword } = this.form.value;
    if (newPassword !== confirmPassword) {
      this.errorMessage = 'The two passwords do not match.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.http
      .post<{ message: string }>(`${API_BASE}/auth/reset-password`, {
        token: this.token,
        newPassword,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.successMessage = res.message;
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.error?.message || 'Reset failed. Please try again.';
        },
      });
  }
}
