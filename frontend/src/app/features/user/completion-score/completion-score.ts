import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WizardStateService } from 'src/app/services/wizard-state';
import { Observable } from 'rxjs';
import { AdmAssessmentSessionProgress } from '../../../services/adm-session';

@Component({
  selector: 'app-completion-score',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './completion-score.html',
  styleUrls: ['./completion-score.css'],
})
export class CompletionScoreComponent {
  progress$: Observable<AdmAssessmentSessionProgress | null>;
  currentStepIndex$: Observable<number>;
  steps$: Observable<string[]>;

  constructor(private wizardState: WizardStateService) {
    this.progress$ = this.wizardState.progress$;
    this.currentStepIndex$ = this.wizardState.currentStepIndex$;
    this.steps$ = this.wizardState.steps$;
  }
}