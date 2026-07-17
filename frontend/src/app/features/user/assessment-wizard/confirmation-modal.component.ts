import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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

  private isOpenSubject = new BehaviorSubject<boolean>(false);
  isOpen$ = this.isOpenSubject.asObservable();

  @Output() close = new EventEmitter<void>();

  @Input()
  set isOpen(value: boolean) {
    this.isOpenSubject.next(value);
  }

  closeModal(): void {
    this.close.emit();
  }
}
