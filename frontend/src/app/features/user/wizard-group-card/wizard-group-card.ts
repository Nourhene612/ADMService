import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionQuestion } from 'src/app/services/adm-session-question';
import { QuestionRendererComponent } from '../question-renderer/question-renderer';

@Component({
  selector: 'app-wizard-group-card',
  standalone: true,
  imports: [CommonModule, QuestionRendererComponent],
  templateUrl: './wizard-group-card.html',
  styleUrls: ['./wizard-group-card.css'],
})
export class WizardGroupCardComponent {
  @Input() subsectionKey!: string;
  @Input() questions: SessionQuestion[] = [];

  formatGroupTitle(key: string): string {
    return key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}