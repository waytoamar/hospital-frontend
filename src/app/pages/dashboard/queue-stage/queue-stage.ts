import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DashboardStore } from '../dashboard.store';
import { ageSex } from '../visit-format';

// Dark card under the board: the selected patient, the main action and who is next.
@Component({
  selector: 'app-queue-stage',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './queue-stage.html',
  styleUrl: './queue-stage.css',
})
export class QueueStage {
  readonly ageSex = ageSex;

  constructor(readonly store: DashboardStore) {}

  get actionLabel(): string {
    const { selectedQueuePanel: panel, selectedQueueVisit: visit } = this.store;
    if (panel === 'followup') return 'Start new visit';
    if (visit?.status === 'In consultation') return 'Complete consultation';
    if (visit?.status === 'Lab investigation') return 'Reports back — resume consultation';
    return 'Call next patient';
  }
}
