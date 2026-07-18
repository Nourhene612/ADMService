import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { WizardStateService } from 'src/app/services/wizard-state';
import { AdmAssessmentSessionRead } from 'src/app/services/adm-session';
import { SessionQuestion } from 'src/app/services/adm-session-question';

import { WizardStepTabsComponent } from '../wizard-step-tabs/wizard-step-tabs';
import { CompletionScoreComponent } from '../completion-score/completion-score';
import { WizardGroupCardComponent } from '../wizard-group-card/wizard-group-card';
import { ConfirmationModalComponent } from './confirmation-modal.component';

@Component({
  selector: 'app-assessment-wizard',
  standalone: true,
  imports: [
    CommonModule,
    WizardStepTabsComponent,
    CompletionScoreComponent,
    WizardGroupCardComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: './assessment-wizard.html',
  styleUrls: ['./assessment-wizard.css'],
})
export class AssessmentWizardComponent implements OnInit {
  // Déclarées SANS initialiseur (pas de "= this.wizardState...." ici)
  session$!: Observable<AdmAssessmentSessionRead | null>;
  steps$!: Observable<string[]>;
  currentStepIndex$!: Observable<number>;
  currentStepGroups$!: Observable<{ [subsectionKey: string]: SessionQuestion[] }>;
  loading$!: Observable<boolean>;
  error$!: Observable<string | null>;
  canSubmit$!: Observable<boolean>;
  missingRequiredQuestions$!: Observable<SessionQuestion[]>;

  modalOpenSubject = new BehaviorSubject<boolean>(false);
  modalOpen$ = this.modalOpenSubject.asObservable();
  modalTitle = '';
  modalMessage = '';
  modalType: 'success' | 'warning' | 'info' = 'info';

  private initialized = false;

  constructor(
    private wizardState: WizardStateService,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Assignation ICI, une fois wizardState correctement injecté
    this.session$ = this.wizardState.session$;
    this.steps$ = this.wizardState.steps$;
    this.currentStepIndex$ = this.wizardState.currentStepIndex$;
    this.currentStepGroups$ = this.wizardState.currentStepGroups$;
    this.loading$ = this.wizardState.loading$;
    this.error$ = this.wizardState.error$;
    this.canSubmit$ = this.wizardState.canSubmit$;
    this.missingRequiredQuestions$ = this.wizardState.missingRequiredQuestions$;

    this.session$.subscribe((session) => {
      if (!session) return;
      if (session.status === 'submitted') {
        this.openModal('Success', 'Your answer is submitted', 'success');
      } else if (session.status === 'cancelled') {
        this.openModal('Session cancelled', 'This session has been cancelled', 'info');
      } else if (session.status === 'expired') {
        this.openModal('Session expired', 'This session has expired', 'warning');
      }
    });
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const sessionUid = this.route.snapshot.paramMap.get('sessionUid');
    if (sessionUid) {
      this.wizardState.loadExistingSession(sessionUid);
    } else {
      this.wizardState.startNewSession('demo-customer', 'enterprise_adm');
    }
  }

  get isFirstStep(): boolean {
    return this.wizardState.isOnFirstStep();
  }

  // Utile pour savoir si on est sur le dernier step (afficher "Submit" au lieu de "Continue")
  isLastStep(steps: string[] | null, currentIndex: number | null): boolean {
    if (!steps || currentIndex === null) return false;
    return currentIndex === steps.length - 1;
  }

  onContinue(): void {
    if (!this.wizardState.isSessionEditable()) return;
    this.wizardState.saveDraft();
    this.wizardState.nextStep();
  }

  onPrevious(): void {
    if (this.isFirstStep) return;
    this.wizardState.previousStep();
  }

  onSaveDraft(): void {
    
    if (!this.wizardState.isSessionEditable()) return;
    this.wizardState.saveDraft();
  }

  onSubmit(): void {
    if (!this.wizardState.isSessionEditable()) return;

    const submittedBy = 'demo-customer';
    this.canSubmit$.pipe(take(1)).subscribe((canSubmit) => {
       
      if (!canSubmit) {
        this.missingRequiredQuestions$.pipe(take(1)).subscribe((questions) => {
          const missingList = questions.map((question) => question.question_text).join('\n');
          this.openModal(
            'Required questions missing',
            `Please complete the following required questions:\n${missingList}`,
            'warning'
          );
        });
        return;
      }
      this.wizardState.submit(submittedBy).subscribe({
        next: () => this.openModal('Success', 'Your answer is submitted', 'success'),
        error: () =>
          this.openModal('Submission failed', 'Unable to submit your answers. Please try again.', 'warning'),
      });
    });
  }

  onCancel(): void {
    if (!this.wizardState.isSessionEditable()) return;
    this.wizardState.cancel('Annulé par utilisateur', 'demo-customer').subscribe();
  }

 closeModal(): void {
  const wasSuccess = this.modalType === 'success';
  this.modalOpenSubject.next(false);

  if (wasSuccess) {
    this.wizardState.startNewSession('demo-customer', 'enterprise_adm');
  }
}
  private openModal(title: string, message: string, type: 'success' | 'warning' | 'info'): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    
    this.modalOpenSubject.next(true);
  }
}