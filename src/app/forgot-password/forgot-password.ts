import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const API_BASE = 'http://localhost:5000/api';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css'],
})
export class ForgotPassword {
  form: FormGroup;
  submitted = false;
  loading = false;
  resultMessage = '';

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    const { email } = this.form.value;

    this.http.post<{ message: string }>(`${API_BASE}/auth/forgot-password`, { email }).subscribe({
      next: (res) => {
        this.loading = false;
        this.submitted = true;
        this.resultMessage = res.message;
      },
      error: () => {
        this.loading = false;
        this.submitted = true;
        this.resultMessage = 'If the email is received, a reset link has been sent.';
      },
    });
  }
}