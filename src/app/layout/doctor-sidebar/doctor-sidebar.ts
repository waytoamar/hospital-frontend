import { Component, EventEmitter, Input, Output } from '@angular/core';

export type DoctorMenuItem = 'board' | 'patients' | 'records' | 'holidays';

const COLLAPSED_KEY = 'doctorSideCollapsed';

// Left menu of the doctor's dashboard. On phones it slides in from the ☰ button.
@Component({
  selector: 'app-doctor-sidebar',
  standalone: true,
  templateUrl: './doctor-sidebar.html',
  styleUrl: './doctor-sidebar.css',
})
export class DoctorSidebar {
  @Input() active: DoctorMenuItem = 'board';
  @Input() todayCount = 0;
  @Input() backupBusy = false;
  @Input() open = false;

  @Output() navigate = new EventEmitter<DoctorMenuItem>();
  @Output() staff = new EventEmitter<void>();
  @Output() backup = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  readonly items: { key: DoctorMenuItem; icon: string; label: string }[] = [
    { key: 'board', icon: '▣', label: 'Today' },
    { key: 'patients', icon: '👥', label: 'Patients' },
    { key: 'records', icon: '📋', label: 'Records' },
    { key: 'holidays', icon: '📅', label: 'Closed days' },
  ];

  /** Desktop: show icons only (remembered on this computer). */
  collapsed = this.readCollapsed();

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    try {
      localStorage.setItem(COLLAPSED_KEY, this.collapsed ? '1' : '0');
    } catch {
      // Storage blocked (private window): works until the page is closed
    }
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }
}
