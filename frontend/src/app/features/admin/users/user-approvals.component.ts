import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApprovalStatus, UserAdminResponse } from '../../../shared/models/ticket.model';
import { UsersService } from '../../../core/services/users.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { getApiErrorMessage } from '../../../core/utils/api-error-message';

@Component({
  selector: 'app-user-approvals',
  templateUrl: './user-approvals.component.html',
  styleUrls: ['./user-approvals.component.css']
})
export class UserApprovalsComponent implements OnDestroy, OnInit {
  users: UserAdminResponse[] = [];
  status: ApprovalStatus = 'Pending';
  loading = true;
  errorMessage = '';
  busyUserId: string | null = null;
  readonly roles: ('Reporter' | 'Technician')[] = ['Reporter', 'Technician'];
  readonly selectedRoles: Record<string, 'Reporter' | 'Technician'> = {};
  readonly rejectionReasons: Record<string, string> = {};

  private readonly subscriptions = new Subscription();

  constructor(
    private usersService: UsersService,
    private realtimeService: RealtimeService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.subscriptions.add(
      this.realtimeService.usersChanged$.subscribe(() => this.loadUsers())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.usersService.getUsers(this.status).subscribe({
      next: (users) => {
        this.users = users;
        for (const user of users) {
          this.selectedRoles[user.id] = user.requestedRole;
        }
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = getApiErrorMessage(error, 'Unable to load account requests.');
        this.loading = false;
      }
    });
  }

  approve(user: UserAdminResponse): void {
    if (this.busyUserId) return;
    this.busyUserId = user.id;
    this.errorMessage = '';
    this.usersService.approve(user.id, this.selectedRoles[user.id] ?? user.requestedRole).subscribe({
      next: () => {
        this.busyUserId = null;
        this.loadUsers();
      },
      error: (error) => {
        this.errorMessage = getApiErrorMessage(error, 'Unable to approve this account.');
        this.busyUserId = null;
      }
    });
  }

  reject(user: UserAdminResponse): void {
    const reason = this.rejectionReasons[user.id]?.trim() ?? '';
    if (this.busyUserId || reason.length < 3) return;
    this.busyUserId = user.id;
    this.errorMessage = '';
    this.usersService.reject(user.id, reason).subscribe({
      next: () => {
        this.busyUserId = null;
        this.loadUsers();
      },
      error: (error) => {
        this.errorMessage = getApiErrorMessage(error, 'Unable to reject this account request.');
        this.busyUserId = null;
      }
    });
  }

  canReject(userId: string): boolean {
    return (this.rejectionReasons[userId] ?? '').trim().length >= 3;
  }
}
