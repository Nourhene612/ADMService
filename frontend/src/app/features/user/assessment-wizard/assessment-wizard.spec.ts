import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AssessmentWizardComponent } from './assessment-wizard';
import { WizardStateService } from 'src/app/services/wizard-state';

describe('AssessmentWizardComponent', () => {
  let component: AssessmentWizardComponent;
  let fixture: ComponentFixture<AssessmentWizardComponent>;
  let wizardState: jasmine.SpyObj<WizardStateService>;

  beforeEach(async () => {
    const wizardStateSpy = jasmine.createSpyObj(
      'WizardStateService',
      ['startNewSession', 'cancel', 'loadExistingSession', 'saveDraft', 'nextStep', 'previousStep', 'submit'],
      {
        session$: of(null),
        steps$: of([]),
        currentStepIndex$: of(0),
        currentStepGroups$: of({}),
        loading$: of(false),
        error$: of(null),
        canSubmit$: of(true),
        missingRequiredQuestions$: of([]),
        isOnFirstStep: () => true,
        isSessionEditable: () => true,
      }
    );

    await TestBed.configureTestingModule({
      imports: [AssessmentWizardComponent],
      providers: [{ provide: WizardStateService, useValue: wizardStateSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentWizardComponent);
    component = fixture.componentInstance;
    wizardState = TestBed.inject(WizardStateService) as jasmine.SpyObj<WizardStateService>;
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
});
