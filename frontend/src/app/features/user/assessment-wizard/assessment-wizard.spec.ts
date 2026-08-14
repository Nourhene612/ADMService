import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AssessmentWizardComponent } from './assessment-wizard';
import { WizardStateService } from 'src/app/services/wizard-state';

describe('AssessmentWizardComponent', () => {
  let component: AssessmentWizardComponent;
  let fixture: ComponentFixture<AssessmentWizardComponent>;
  let wizardState: any;

  beforeEach(async () => {
    const wizardStateSpy = vi.fn();

    const state = {
      session$: of(null),
      steps$: of([]),
      currentStepIndex$: of(0),
      currentStepGroups$: of({}),
      loading$: of(false),
      error$: of(null),
      canSubmit$: of(true),
      missingRequiredQuestions$: of([]),
      hasUnsavedChanges: vi.fn(() => false),
      isOnFirstStep: vi.fn(() => true),
      isSessionEditable: vi.fn(() => true),
      saveDraft: vi.fn(),
      reset: vi.fn(),
      startNewSession: vi.fn(),
      cancel: vi.fn(),
      loadExistingSession: vi.fn(),
      nextStep: vi.fn(),
      previousStep: vi.fn(),
      submit: vi.fn(),
    };

    Object.assign(wizardStateSpy, state);

    await TestBed.configureTestingModule({
      imports: [AssessmentWizardComponent],
      providers: [{ provide: WizardStateService, useValue: state }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentWizardComponent);
    component = fixture.componentInstance;
    wizardState = state;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should restart a new session when the cancellation modal closes', () => {
    component.modalType = 'info';
    component.closeModal();

    expect(wizardState.startNewSession).toHaveBeenCalledWith('demo-customer', 'enterprise_adm');
  });

  it('should request save confirmation when leaving with unsaved changes', () => {
    wizardState.hasUnsavedChanges = vi.fn(() => true);

    component.confirmLeave();

    expect(component.modalTitle).toBe('Do you want to save your answers?');
    expect(component.modalMessage).toContain('Would you like to save them as a draft before leaving this page?');
    expect(component.modalButtons).toEqual([
      { label: "Don't Save", action: 'dont-save' },
      { label: 'Save', action: 'save-draft' },
    ]);
    expect(component.modalOpenSubject.value).toBe(true);
  });
});
