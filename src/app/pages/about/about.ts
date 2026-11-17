import { Component } from '@angular/core';
import { SiteLayout } from '../../layout/site-layout/site-layout';
import { CLINIC } from '../../shared/clinic-info';

// Public "About Us" page (/about)
@Component({
  selector: 'app-about',
  standalone: true,
  imports: [SiteLayout],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  readonly clinic = CLINIC;

  readonly credentials = [
    'MBBS, DNB (Pulmonology)',
    'Fellowship in Respiratory ICU',
    'Intensivist & Sleep Specialist',
    'Allergy Specialist, Interventional Pulmonologist',
    'Critical Care (ICU) Ventilator & Bronchoscopy Specialist',
    'Asst. Professor, Dept. of Pulmonary Medicine, CIMS CWA',
    'Ex. Consultant, WCL Hospital Barkuhi',
  ];
}
