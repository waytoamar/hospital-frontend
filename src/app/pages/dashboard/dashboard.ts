import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DoctorSidebar } from '../../layout/doctor-sidebar/doctor-sidebar';
import { Holidays } from '../../shared/holidays/holidays';
import { DashboardStore } from './dashboard.store';
import { Topbar } from './topbar/topbar';
import { Toolbar } from './toolbar/toolbar';
import { QueueBoard } from './queue-board/queue-board';
import { QueueStage } from './queue-stage/queue-stage';
import { Collections } from './collections/collections';
import { PatientsList } from './patients-list/patients-list';
import { RecordsList } from './records-list/records-list';
import { PatientHistory } from './patient-history/patient-history';
import { VisitForm } from './visit-form/visit-form';

// Doctor's page (/dashboard): left menu, top bar and one of the screens below it.
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DoctorSidebar,
    Topbar,
    Toolbar,
    QueueBoard,
    QueueStage,
    Collections,
    PatientsList,
    RecordsList,
    Holidays,
    PatientHistory,
    VisitForm,
  ],
  providers: [DashboardStore],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  menuOpen = false; // phones: left menu slid in

  @ViewChild('queueStage', { read: ElementRef }) private queueStage?: ElementRef<HTMLElement>;

  constructor(readonly store: DashboardStore) {}

  ngOnInit(): void {
    this.store.start();
  }

  get todayCount(): number {
    return this.store.boardWaiting.length + this.store.boardConsulting.length;
  }

  /** A patient was picked on the board: bring the queue card into view. */
  scrollToQueue(): void {
    setTimeout(() =>
      this.queueStage?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
}
