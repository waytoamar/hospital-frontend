import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CLINIC } from '../clinic-info';

// Header + footer around the public pages (Home, About Us). Page content goes in <ng-content>.
@Component({
  selector: 'app-site-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-shell.html',
  styleUrl: './site-shell.css',
})
export class SiteShell {
  readonly clinic = CLINIC;
  readonly year = new Date().getFullYear();
}
