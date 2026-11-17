import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CLINIC } from '../../shared/clinic-info';

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.html',
  styleUrls: ['../../shared/styles/site.css', './site-header.css'],
})
export class SiteHeader {
  readonly clinic = CLINIC;
}
