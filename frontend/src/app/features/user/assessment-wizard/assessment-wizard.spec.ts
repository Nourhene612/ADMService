import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssessmentWizardComponent } from './assessment-wizard';

describe('AssessmentWizardComponent', () => {
  let component: AssessmentWizardComponent;
  let fixture: ComponentFixture<AssessmentWizardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentWizardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentWizardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
