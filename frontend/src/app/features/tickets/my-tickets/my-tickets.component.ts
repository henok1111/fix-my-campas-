import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TicketService } from 'src/app/core/services/ticket.service';
import { RealtimeService } from 'src/app/core/services/realtime.service';
import { Ticket } from 'src/app/shared/models/ticket.model';
import { getApiErrorMessage } from 'src/app/core/utils/api-error-message';

@Component({
  selector: 'app-my-tickets',
  templateUrl: './my-tickets.component.html',
  styleUrls: ['./my-tickets.component.css']
})
export class MyTicketsComponent implements OnDestroy, OnInit {
  tickets: Ticket[] = [];
  errorMessage = '';
  loading = true;

  private readonly subscriptions = new Subscription();

  constructor(
    private ticketService: TicketService,
    private realtimeService: RealtimeService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.realtimeService.ticketsChanged$.subscribe(() => this.loadTickets())
    );
    this.loadTickets();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadTickets(): void {
    this.ticketService.getMyTickets({ page: 1, pageSize: 50 }).subscribe({
      next: (result) => {
        this.tickets = result.items;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = getApiErrorMessage(err, 'Unable to load your reports.');
        this.loading = false;
      }
    });
  }
}
