import { Component } from '@angular/core';
import { SiteHeader } from '../site-header/site-header';
import { SiteFooter } from '../site-footer/site-footer';

// Frame of the public website: header, the page, footer.
// Also holds the website colours and fonts (CSS variables) used by everything inside it.
@Component({
  selector: 'app-site-layout',
  standalone: true,
  imports: [SiteHeader, SiteFooter],
  templateUrl: './site-layout.html',
  styleUrl: './site-layout.css',
})
export class SiteLayout {}
