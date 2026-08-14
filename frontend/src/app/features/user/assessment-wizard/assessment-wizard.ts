import { Component, OnInit, Inject, PLATFORM_ID, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser, KeyValue } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { WizardStateService } from 'src/app/services/wizard-state';
import { AdmAssessmentSessionRead } from 'src/app/services/adm-session';
import { SessionQuestion } from 'src/app/services/adm-session-question';

import { WizardStepTabsComponent } from '../wizard-step-tabs/wizard-step-tabs';
import { CompletionScoreComponent } from '../completion-score/completion-score';
import { WizardGroupCardComponent } from '../wizard-group-card/wizard-group-card';
import { ConfirmationModalComponent, ModalButton } from './confirmation-modal.component';

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
export class AssessmentWizardComponent implements OnInit, OnDestroy {
  session$!: Observable<AdmAssessmentSessionRead | null>;
  steps$!: Observable<string[]>;
  currentStepIndex$!: Observable<number>;
  currentStepGroups$!: Observable<{ [subsectionKey: string]: SessionQuestion[] }>;
  loading$!: Observable<boolean>;
  error$!: Observable<string | null>;
  canSubmit$!: Observable<boolean>;
  missingRequiredQuestions$!: Observable<SessionQuestion[]>;
  hasUnsavedChanges$!: Observable<boolean>;

  modalOpenSubject = new BehaviorSubject<boolean>(false);
  modalOpen$ = this.modalOpenSubject.asObservable();
  modalTitle = '';
  modalMessage = '';
  modalType: 'success' | 'warning' | 'info' = 'info';
  modalButtons: ModalButton[] = [];

  private initialized = false;
  private leaveConfirmationResolver: ((value: boolean) => void) | null = null;

  constructor(
    private wizardState: WizardStateService,
    private route: ActivatedRoute,
    private router: Router,
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
    this.hasUnsavedChanges$ = this.wizardState.hasUnsavedChanges$;

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

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (!this.wizardState.hasUnsavedChanges()) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  }

  ngOnDestroy(): void {
    if (this.leaveConfirmationResolver) {
      this.leaveConfirmationResolver(false);
      this.leaveConfirmationResolver = null;
    }
  }

  canDeactivate(): Observable<boolean> | Promise<boolean> | boolean {
    if (!this.wizardState.hasUnsavedChanges()) {
      return true;
    }

    this.confirmLeave();

    return new Promise<boolean>((resolve) => {
      this.leaveConfirmationResolver = resolve;
    });
  }

  confirmLeave(): void {
    this.modalTitle = 'Do you want to save your answers?';
    this.modalMessage =
      'You have unsaved answers. Would you like to save them as a draft before leaving this page?';
    this.modalType = 'info';
    this.modalButtons = [
      { label: "Don't Save", action: 'dont-save' },
      { label: 'Save', action: 'save-draft' },
    ];
    this.modalOpenSubject.next(true);
  }

  onModalButtonClick(action: string): void {
    if (action === 'save-draft') {
      this.wizardState.saveDraft();
      this.hasUnsavedChanges$.pipe(take(1)).subscribe((hasUnsaved) => {
        if (!hasUnsaved) {
          this.closeModal();
          this.resolveLeaveDecision(true);
        }
      });
    } else if (action === 'dont-save') {
      this.wizardState.reset();
      this.closeModal();
      this.resolveLeaveDecision(true);
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

  trackByGroupKey(index: number, entry: KeyValue<string, SessionQuestion[]>): string {
    return entry.key;
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
    this.hasUnsavedChanges$.pipe(take(1)).subscribe((hasUnsaved) => {
      if (!hasUnsaved) {
        this.openModal('Draft Saved', 'Your answers have been saved as a draft.', 'success');
      }
    });
  }

  onSubmit(): void {
    if (!this.wizardState.isSessionEditable()) return;

    const submittedBy = 'demo-customer';
    this.canSubmit$.pipe(take(1)).subscribe((canSubmit) => {
       
     if (!canSubmit) {
  this.openModal(
    'Required questions missing',
    'Please complete all required questions before submitting.',
    'warning'
  );
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
  const shouldRestart = this.modalType === 'success' || this.modalType === 'info';
  this.modalOpenSubject.next(false);

  if (shouldRestart && this.modalButtons.length === 0) {
    // Only restart if not in unsaved changes flow
    this.wizardState.startNewSession('demo-customer', 'enterprise_adm');
  }
}

  private resolveLeaveDecision(shouldContinue: boolean): void {
    if (this.leaveConfirmationResolver) {
      this.leaveConfirmationResolver(shouldContinue);
      this.leaveConfirmationResolver = null;
    }
  }

  private openModal(title: string, message: string, type: 'success' | 'warning' | 'info'): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.modalButtons = [];
    
    this.modalOpenSubject.next(true);
  }
}