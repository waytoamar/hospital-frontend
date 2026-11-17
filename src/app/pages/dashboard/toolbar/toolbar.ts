import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DashboardStore } from '../dashboard.store';
import { BoardFilter } from '../dashboard.models';

// Search box, board filter chips and the "New visit" button.
@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './toolbar.html',
  styleUrls: ['../dashboard-theme.css', './toolbar.css'],
})
export class Toolbar {
  constructor(readonly store: DashboardStore) {}

  get chips(): { key: BoardFilter; label: string; count?: number }[] {
    const s = this.store;
    return [
      { key: 'all', label: 'All' },
      { key: 'waiting', label: 'Waiting', count: s.boardWaiting.length },
      { key: 'consult', label: 'Consult', count: s.boardConsulting.length },
      { key: 'followup', label: 'Follow-up', count: s.boardFollowUps.length },
      { key: 'done', label: 'Done', count: s.boardCompleted.length },
    ];
  }

  get placeholder(): string {
    return `Search name, ID, phone or token — ${this.store.todayVisits.length} in today's`;
  }
}
