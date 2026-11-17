import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CLINIC } from '../../shared/clinic-info';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './site-footer.html',
  styleUrls: ['../../shared/styles/site.css', './site-footer.css'],
})
export class SiteFooter {
  readonly clinic = CLINIC;
  readonly year = new Date().getFullYear();
  readonly mapLink =
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(`${CLINIC.name}, ${CLINIC.address.join(' ')}`);
}
