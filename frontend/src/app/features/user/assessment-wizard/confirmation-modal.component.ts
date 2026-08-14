import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ModalButton {
  label: string;
  action: string;
  class?: 'primary' | 'secondary' | 'danger';
}

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.css'],
})
export class ConfirmationModalComponent {
  @Input() title = '';
  @Input() message = '';
  @Input() type: 'success' | 'warning' | 'info' = 'info';
  @Input() showTwoButtons = false;
  @Input() cancelLabel = 'Cancel';
  @Input() confirmLabel = 'Confirm';
  @Input() confirmButtonColor: 'blue' | 'orange' = 'orange';
  @Input() buttons: ModalButton[] = []; // For custom button layouts

  private isOpenSubject = new BehaviorSubject<boolean>(false);
  isOpen$ = this.isOpenSubject.asObservable();

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() buttonClick = new EventEmitter<string>(); // Emits the action of clicked button

  @Input()
  set isOpen(value: boolean) {
    this.isOpenSubject.next(value);
  }

  closeModal(): void {
    this.isOpenSubject.next(false);
    this.close.emit();
  }

  onCancel(): void {
    this.cancel.emit();
    this.closeModal();
  }

  onConfirm(): void {
    this.confirm.emit();
    this.closeModal();
  }

  onButtonClick(action: string): void {
    this.buttonClick.emit(action);
    this.closeModal();
  }

  getButtonClass(btnClass?: 'primary' | 'secondary' | 'danger'): string {
    switch (btnClass) {
      case 'primary':
        return 'btn-confirm btn-confirm-primary';
      case 'secondary':
        return 'btn-cancel';
      case 'danger':
        return 'btn-confirm btn-confirm-primary';
      default:
        return 'btn-cancel';
    }
  }
}
