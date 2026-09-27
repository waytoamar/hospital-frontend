import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

const API_BASE = 'https://hospital-backend-yxe9.onrender.com/api';

interface LoginInfo {
  displayName: string;
  avatarUrl: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  errorMessage = '';
  loading = false;

  doctorPhoto = 'assets/doctor.jpg';
  doctorName = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.http.get<LoginInfo>(`${API_BASE}/auth/login-info`).subscribe({
      next: (info) => {
        this.doctorName = info.displayName || '';
        if (info.avatarUrl) {
          this.doctorPhoto = info.avatarUrl;
        }
      },
      error: () => {},
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { username, password } = this.form.value;

    this.http
      .post(
        `${API_BASE}/auth/login`,
        { username, password },
        { withCredentials: true }
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage =
            err?.error?.message || 'Login failed. Please try again.';
        },
      });
  }
}