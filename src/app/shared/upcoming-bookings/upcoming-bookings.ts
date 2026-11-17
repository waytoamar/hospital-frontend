import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionService, UpcomingBooking } from '../../services/staff';

interface DayGroup {
  day: string;
  label: string;
  bookings: UpcomingBooking[];
}

// WhatsApp bookings for tomorrow and later, grouped by day, on the reception board.
// (Today's WhatsApp bookings are already on the board with a "WhatsApp booking" badge.)
@Component({
  selector: 'app-upcoming-bookings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upcoming-bookings.html',
  styleUrl: './upcoming-bookings.css',
})
export class UpcomingBookings implements OnInit, OnDestroy {
  groups: DayGroup[] = [];
  total = 0;
  open = false;
  error = '';
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private api: ReceptionService) {}

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => this.load(), 60000); // new WhatsApp bookings show up by themselves
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  load(): void {
    this.api.upcoming().subscribe({
      next: (list) => {
        this.error = '';
        this.total = list.length;
        const byDay = new Map<string, UpcomingBooking[]>();
        for (const b of list) {
          byDay.set(b.visitDay, [...(byDay.get(b.visitDay) || []), b]);
        }
        this.groups = [...byDay.entries()].map(([day, bookings]) => ({
          day,
          label: this.label(day),
          bookings,
        }));
      },
      error: () => (this.error = 'Upcoming bookings could not be loaded.'),
    });
  }

  // "Sat, 24 Oct"
  private label(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
}
