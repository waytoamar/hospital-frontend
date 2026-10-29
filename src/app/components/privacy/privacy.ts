import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Public page (no login): https://chestandallergyclinic.vercel.app/privacy
// Meta asks for this link when the clinic sets up WhatsApp Business.
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy.html',
  styleUrl: './privacy.css',
})
export class Privacy {
  readonly clinic = {
    name: 'Chest & Allergy Clinic',
    doctor: 'Dr. Mahesh',
    address: 'Mansarovar Complex, Behind Bus Stand, Chhindwara (M.P.)',
    phones: '8109838316, 8817483758',
  };

  readonly updated = '23 October 2026';
}
