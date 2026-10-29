import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteShell } from '../site-shell/site-shell';
import { CLINIC } from '../clinic-info';

// Public home page (https://chestandallergyclinic.vercel.app/)
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, SiteShell],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  readonly clinic = CLINIC;

  readonly credentials = [
    { top: 'Fellowship', sub: 'Respiratory ICU' },
    { top: 'Intensivist', sub: '& Sleep Specialist' },
    { top: 'Interventional', sub: 'Pulmonologist' },
    { top: 'Asst. Professor', sub: 'Pulmonary Medicine, CIMS' },
  ];

  readonly services = [
    { icon: '🌬️', title: 'Asthma & Allergy', text: 'Allergy testing, inhaler plans and long-term control.' },
    { icon: '💨', title: 'COPD & ILD', text: 'Breathing tests and care for chronic lung disease.' },
    { icon: '🛡️', title: 'Tuberculosis & Pneumonia', text: 'Fast diagnosis and complete treatment.' },
    { icon: '😴', title: 'Sleep Disorders', text: 'Snoring and sleep apnea evaluation.' },
    { icon: '🔬', title: 'Bronchoscopy', text: 'Interventional procedures for diagnosis & treatment.' },
    { icon: '🏥', title: 'ICU & Ventilator Care', text: 'Critical care for severe breathing problems.' },
  ];
}
