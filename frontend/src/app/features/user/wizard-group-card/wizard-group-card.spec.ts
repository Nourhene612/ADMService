import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WizardGroupCardComponent } from './wizard-group-card';

describe('WizardGroupCardComponent', () => {
  let component: WizardGroupCardComponent;
  let fixture: ComponentFixture<WizardGroupCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WizardGroupCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WizardGroupCardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
