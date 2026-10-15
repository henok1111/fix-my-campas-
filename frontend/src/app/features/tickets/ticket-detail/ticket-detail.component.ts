import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/core/services/auth.service';
import { TicketService } from 'src/app/core/services/ticket.service';
import { Ticket, TicketAttachment, TicketHistoryItem, Technician, TicketStatus } from 'src/app/shared/models/ticket.model';
import { getApiErrorMessage } from 'src/app/core/utils/api-error-message';

@Component({
  selector: 'app-ticket-detail',
  templateUrl: './ticket-detail.component.html',
  styleUrls: ['./ticket-detail.component.css']
})
export class TicketDetailComponent implements OnDestroy, OnInit {
  ticket: Ticket | null = null;
  history: TicketHistoryItem[] = [];
  technicians: Technician[] = [];
  selectedTechnicianId = 0;
  loading = true;
  loadingTechnicians = false;
  saving = false;
  errorMessage = '';
  attachmentUrls: Record<number, string> = {};
  attachmentLoading: Record<number, boolean> = {};
  attachmentErrors: Record<number, string> = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private ticketService: TicketService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isInteger(id) && id > 0) {
      this.loadTicket(id);
      if (this.isAdmin) {
        this.loadTechnicians();
      }
    } else {
      this.loading = false;
      this.errorMessage = 'Ticket not found.';
    }
  }

  ngOnDestroy(): void {
    Object.values(this.attachmentUrls).forEach((url) => URL.revokeObjectURL(url));
  }

  get isAdmin(): boolean {
    return this.authService.getUserRole() === 'Admin';
  }

  get canUpdateStatus(): boolean {
    const role = this.authService.getUserRole();
    return role === 'Admin' || role === 'Technician';
  }

  loadTicket(id: number): void {
    this.loading = true;
    this.errorMessage = '';

    this.ticketService.getTicket(id).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.history = ticket.history;
        this.loading = false;
        ticket.attachments
          .filter((attachment) => this.isImage(attachment))
          .forEach((attachment) => this.loadAttachmentPreview(attachment));
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = getApiErrorMessage(err, 'Unable to load this ticket.');
      }
    });
  }

  isImage(attachment: TicketAttachment): boolean {
    return attachment.contentType.startsWith('image/');
  }

  isAudio(attachment: TicketAttachment): boolean {
    return attachment.contentType.startsWith('audio/');
  }

  isVideo(attachment: TicketAttachment): boolean {
    return attachment.contentType.startsWith('video/');
  }

  loadAttachmentPreview(attachment: TicketAttachment): void {
    if (!this.ticket || this.attachmentUrls[attachment.id] || this.attachmentLoading[attachment.id]) {
      return;
    }

    this.attachmentLoading[attachment.id] = true;
    delete this.attachmentErrors[attachment.id];

    this.ticketService.downloadAttachment(this.ticket.id, attachment.id).subscribe({
      next: (blob) => {
        this.attachmentUrls[attachment.id] = URL.createObjectURL(blob);
        this.attachmentLoading[attachment.id] = false;
      },
      error: (err) => {
        this.attachmentLoading[attachment.id] = false;
        this.attachmentErrors[attachment.id] = getApiErrorMessage(err, 'Unable to load this attachment.');
      }
    });
  }

  loadTechnicians(): void {
    this.loadingTechnicians = true;
    this.ticketService.getTechnicians().subscribe({
      next: (technicians) => {
        this.technicians = technicians;
        this.loadingTechnicians = false;
      },
      error: (err) => {
        this.loadingTechnicians = false;
        this.errorMessage = getApiErrorMessage(err, 'Unable to load technicians.');
      }
    });
  }

  assignTechnician(): void {
    if (!this.ticket || !this.selectedTechnicianId || this.saving) {
      return;
    }

    this.errorMessage = '';
    this.saving = true;
    this.ticketService.assignTechnician(this.ticket.id, { technicianId: this.selectedTechnicianId }).subscribe({
      next: (updated) => {
        this.ticket = updated;
        this.history = updated.history;
        this.saving = false;
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = getApiErrorMessage(err, 'Unable to assign this ticket.');
      }
    });
  }

  updateStatus(status: TicketStatus): void {
    if (!this.ticket || this.saving) {
      return;
    }

    this.errorMessage = '';
    this.saving = true;
    this.ticketService.updateStatus(this.ticket.id, { newStatus: status }).subscribe({
      next: (updated) => {
        this.ticket = updated;
        this.history = updated.history;
        this.saving = false;
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = getApiErrorMessage(err, 'Unable to update ticket status.');
      }
    });
  }

  confirmFix(): void {
    if (!this.ticket || this.saving) return;

    this.errorMessage = '';
    this.saving = true;
    this.ticketService.confirmFix(this.ticket.id).subscribe({
      next: (updated) => {
        this.ticket = updated;
        this.history = updated.history;
        this.saving = false;
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = getApiErrorMessage(err, 'Unable to confirm this fix.');
      }
    });
  }

  get canConfirmFix(): boolean {
    return this.authService.getUserRole() === 'Reporter'
      && this.ticket?.status === 'Resolved'
      && !this.ticket.confirmedFixedAt;
  }

  get authRoleLabel(): string {
    return this.authService.getUserRole() === 'Technician' ? 'work queue' : 'reports';
  }

  goBack(): void {
    const role = this.authService.getUserRole();
    this.router.navigate([role === 'Admin' ? '/admin' : role === 'Technician' ? '/technician' : '/reporter']);
  }
}
