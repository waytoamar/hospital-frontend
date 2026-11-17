import { Component, EventEmitter, Output } from '@angular/core';
import { Visit } from '../../../services/visit';
import { DashboardStore } from '../dashboard.store';
import { BoardPanel, PanelKey } from '../dashboard.models';
import { ageSex } from '../visit-format';

const PREVIEW_ROWS = 3;
const FOLDED_KEY = 'doctor-closed-panels';

// Today's board: Waiting, In consultation, Lab, Follow-up and Completed panels.
@Component({
  selector: 'app-queue-board',
  standalone: true,
  templateUrl: './queue-board.html',
  styleUrls: ['../dashboard-theme.css', './queue-board.css'],
})
export class QueueBoard {
  /** A patient row was clicked (the page scrolls to the queue card). */
  @Output() patientSelected = new EventEmitter<void>();

  readonly ageSex = ageSex;
  private expanded = new Set<PanelKey>();
  private folded: Record<string, boolean> = this.readFolded();

  constructor(readonly store: DashboardStore) {}

  get panels(): BoardPanel[] {
    const s = this.store;
    const all: BoardPanel[] = [
      { key: 'waiting', label: 'WAITING', note: 'checked in today', empty: 'No patients waiting', visits: s.boardWaiting },
      { key: 'consult', label: 'IN CONSULTATION', note: 'active now', empty: 'No active consultation', visits: s.boardConsulting },
      { key: 'lab', label: 'LAB INVESTIGATION', note: 'gone for tests / reports', empty: 'No patients at the lab', visits: s.boardLab },
      { key: 'followup', label: 'FOLLOW-UP', note: 'due in next 7 days', empty: 'No follow-ups this week', visits: s.boardFollowUps },
      { key: 'done', label: 'COMPLETED', note: 'since morning', empty: 'No completed visits', visits: s.boardCompleted },
    ];
    return s.boardFilter === 'all' ? all : all.filter((panel) => panel.key === s.boardFilter);
  }

  get showAll(): boolean {
    return this.store.boardFilter !== 'all';
  }

  select(visit: Visit, panel: PanelKey): void {
    this.store.selectQueue(visit, panel);
    this.patientSelected.emit();
  }

  // ---- "+3 more" / "Show less" ----
  isExpanded(key: PanelKey): boolean {
    return this.expanded.has(key);
  }

  toggleExpanded(key: PanelKey): void {
    if (!this.expanded.delete(key)) {
      this.expanded.add(key);
    }
  }

  rows(panel: BoardPanel): Visit[] {
    return this.showAll || this.isExpanded(panel.key) ? panel.visits : panel.visits.slice(0, PREVIEW_ROWS);
  }

  hiddenCount(panel: BoardPanel): number {
    return this.showAll ? 0 : Math.max(0, panel.visits.length - PREVIEW_ROWS);
  }

  // ---- Close / open a panel (remembered on this computer) ----
  isFolded(key: PanelKey): boolean {
    return !!this.folded[key];
  }

  toggleFolded(key: PanelKey): void {
    this.folded = { ...this.folded, [key]: !this.folded[key] };
    try {
      localStorage.setItem(FOLDED_KEY, JSON.stringify(this.folded));
    } catch {
      // Storage blocked (private window): works until the page is closed
    }
  }

  private readFolded(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(FOLDED_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }
}
