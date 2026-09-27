import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

const API_BASE = 'http://localhost:5000/api';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css'],
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
    private router: Router
  ) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.errorMessage = 'Reset link invalid. మళ్ళీ "Forgot password" నుండి ట్రై చేయండి.';
    }
  }

  submit(): void {
    if (this.form.invalid || this.loading || !this.token) {
      return;
    }

    const { newPassword, confirmPassword } = this.form.value;
    if (newPassword !== confirmPassword) {
      this.errorMessage = 'రెండు పాస్‌వర్డ్‌లు మ్యాచ్ అవ్వలేదు';
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