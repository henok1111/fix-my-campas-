import { HttpEventType } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TicketService } from 'src/app/core/services/ticket.service';
import { Building, Ticket, TicketCategory } from 'src/app/shared/models/ticket.model';
import { getApiErrorMessage } from 'src/app/core/utils/api-error-message';

@Component({
  selector: 'app-create-ticket',
  templateUrl: './create-ticket.component.html',
  styleUrls: ['./create-ticket.component.css']
})
export class CreateTicketComponent implements OnDestroy, OnInit {
  ticketForm: FormGroup;
  buildings: Building[] = [];
  readonly categories: TicketCategory[] = ['Computer', 'Network', 'Projector', 'Plumbing', 'Electrical', 'Other'];
  errorMessage = '';
  buildingErrorMessage = '';
  successMessage = '';
  createdTicket: Ticket | null = null;
  selectedFiles: File[] = [];
  readonly selectedFilePreviews = new Map<File, string>();
  uploading = false;
  uploadingFileName = '';
  uploadProgress = 0;
  uploadedFileCount = 0;
  uploadTotalFiles = 0;
  submitting = false;
  loadingBuildings = true;

  constructor(private fb: FormBuilder, private ticketService: TicketService) {
    this.ticketForm = this.fb.group({
      category: ['', Validators.required],
      buildingId: ['', Validators.required],
      room: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      urgency: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.ticketService.getBuildings().subscribe({
      next: (buildings) => {
        this.buildings = buildings;
        this.loadingBuildings = false;
      },
      error: (err) => {
        this.buildingErrorMessage = getApiErrorMessage(err, 'Unable to load campus buildings.');
        this.loadingBuildings = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.releaseSelectedFilePreviews();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const supportedFiles = files.filter(file =>
      file.type.startsWith('image/') ||
      file.type.startsWith('audio/') ||
      file.type.startsWith('video/')
    );

    const emptyFile = supportedFiles.find(file => file.size === 0);
    if (emptyFile) {
      this.errorMessage = `${emptyFile.name} is empty. Choose a non-empty file.`;
      input.value = '';
      return;
    }

    if (supportedFiles.length !== files.length) {
      this.errorMessage = 'Only image, audio, and video files are supported.';
      input.value = '';
      return;
    }

    const oversized = supportedFiles.find(file => file.size > 50 * 1024 * 1024);
    if (oversized) {
      this.errorMessage = `${oversized.name} is larger than 50 MB.`;
      input.value = '';
      return;
    }

    this.errorMessage = '';
    this.selectedFiles = [...this.selectedFiles, ...supportedFiles];
    for (const file of supportedFiles) {
      if (file.type.startsWith('image/')) {
        this.selectedFilePreviews.set(file, URL.createObjectURL(file));
      }
    }
    input.value = '';
  }

  removeFile(index: number): void {
    const [file] = this.selectedFiles.splice(index, 1);
    const previewUrl = this.selectedFilePreviews.get(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      this.selectedFilePreviews.delete(file);
    }
  }

  filePreview(file: File): string | undefined {
    return this.selectedFilePreviews.get(file);
  }

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.submitting || this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      if (this.ticketForm.invalid) {
        this.errorMessage = 'Please complete all required fields. Description must be at least 10 characters.';
      }
      return;
    }

    this.submitting = true;
    this.createdTicket = null;

    try {
      const ticket = await new Promise<Ticket>((resolve, reject) => {
        this.ticketService.createTicket(this.ticketForm.getRawValue()).subscribe({
          next: resolve,
          error: reject
        });
      });

      this.createdTicket = ticket;
      this.uploadTotalFiles = this.selectedFiles.length;
      this.uploadedFileCount = 0;

      for (const [index, file] of this.selectedFiles.entries()) {
        this.uploading = true;
        this.uploadingFileName = file.name;
        this.uploadProgress = 0;
        await new Promise<void>((resolve, reject) => {
          this.ticketService.uploadAttachment(ticket.id, file).subscribe({
            next: (event) => {
              if (event.type === HttpEventType.UploadProgress) {
                const total = event.total ?? file.size;
                this.uploadProgress = total > 0
                  ? Math.min(100, Math.round((event.loaded / total) * 100))
                  : 0;
              } else if (event.type === HttpEventType.Response) {
                resolve();
              }
            },
            error: reject
          });
        });
        this.uploadedFileCount = index + 1;
      }

      this.createdTicket = await new Promise<Ticket>((resolve, reject) => {
        this.ticketService.getTicket(ticket.id).subscribe({
          next: resolve,
          error: reject
        });
      });
      this.successMessage = 'Ticket created successfully.';
      this.ticketForm.reset();
      this.clearSelectedFiles();
    } catch (err) {
      this.errorMessage = getApiErrorMessage(err, 'Unable to create the ticket right now.');
    } finally {
      this.submitting = false;
      this.uploading = false;
      this.uploadingFileName = '';
      this.uploadProgress = 0;
      this.uploadedFileCount = 0;
      this.uploadTotalFiles = 0;
    }
  }

  private clearSelectedFiles(): void {
    this.releaseSelectedFilePreviews();
    this.selectedFiles = [];
  }

  private releaseSelectedFilePreviews(): void {
    for (const previewUrl of this.selectedFilePreviews.values()) {
      URL.revokeObjectURL(previewUrl);
    }
    this.selectedFilePreviews.clear();
  }
}
