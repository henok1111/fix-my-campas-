import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private readonly ticketsChangedSubject = new Subject<void>();
  private readonly usersChangedSubject = new Subject<void>();
  private connection: HubConnection | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly ticketsChanged$ = this.ticketsChangedSubject.asObservable();
  readonly usersChanged$ = this.usersChangedSubject.asObservable();

  connect(): void {
    if (this.connection) {
      return;
    }

    const hubUrl = `${environment.apiUrl.replace(/\/api\/?$/, '')}/hubs/updates`;
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { withCredentials: true })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection = connection;
    connection.on('TicketsChanged', () => this.ticketsChangedSubject.next());
    connection.on('UsersChanged', () => this.usersChangedSubject.next());
    connection.onreconnected(() => {
      this.ticketsChangedSubject.next();
      this.usersChangedSubject.next();
    });
    connection.onclose((error) => {
      if (error) {
        console.error('SignalR connection closed.', error);
      }
      this.scheduleReconnect(connection);
    });

    this.start(connection);
  }

  disconnect(): void {
    const connection = this.connection;
    this.connection = null;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (connection) {
      connection.stop().catch((error) => {
        console.error('Unable to stop the SignalR connection.', error);
      });
    }
  }

  private start(connection: HubConnection): void {
    connection.start().catch((error) => {
      console.error('Unable to start the SignalR connection.', error);
      this.scheduleReconnect(connection);
    });
  }

  private scheduleReconnect(connection: HubConnection): void {
    if (this.connection !== connection || this.retryTimer) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.start(connection);
    }, 5000);
  }
}
