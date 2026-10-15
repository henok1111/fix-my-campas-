import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TicketService } from 'src/app/core/services/ticket.service';
import { RealtimeService } from 'src/app/core/services/realtime.service';
import { Building, Ticket, TicketStatus } from 'src/app/shared/models/ticket.model';
import { getApiErrorMessage } from 'src/app/core/utils/api-error-message';

@Component({
  selector: 'app-ticket-list',
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.css']
})
export class TicketListComponent implements OnDestroy, OnInit {
  tickets: Ticket[] = [];
  buildings: Building[] = [];
  buildingFilter: number | null = null;
  statusFilter: TicketStatus | '' = '';
  totalCount = 0;
  loading = false;
  errorMessage = '';

  private readonly subscriptions = new Subscription();

  constructor(
    private ticketService: TicketService,
    private realtimeService: RealtimeService
  ) {}

  ngOnInit(): void {
    this.ticketService.getBuildings().subscribe({
      next: (buildings) => this.buildings = buildings,
      error: (err) => this.errorMessage = getApiErrorMessage(err, 'Unable to load campus buildings.')
    });
    this.loadTickets();
    this.subscriptions.add(
      this.realtimeService.ticketsChanged$.subscribe(() => this.loadTickets())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadTickets(): void {
    this.loading = true;
    this.errorMessage = '';

    this.ticketService.getTickets({
      buildingId: this.buildingFilter ?? undefined,
      status: this.statusFilter || undefined,
      pageSize: 50
    }).subscribe({
      next: (result) => {
        this.tickets = result.items;
        this.totalCount = result.totalCount;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = getApiErrorMessage(err, 'Unable to load the campus feed.');
      }
    });
  }
}
