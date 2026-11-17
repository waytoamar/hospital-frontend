import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Root of the app: every page is shown in the router outlet (see app.routes.ts).
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {}
