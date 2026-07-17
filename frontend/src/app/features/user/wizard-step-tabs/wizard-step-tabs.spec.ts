import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WizardStepTabsComponent } from './wizard-step-tabs';

describe('WizardStepTabsComponent', () => {
  let component: WizardStepTabsComponent;
  let fixture: ComponentFixture<WizardStepTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WizardStepTabsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WizardStepTabsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
