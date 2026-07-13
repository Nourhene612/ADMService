import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionGeneral } from './question-general';

describe('QuestionGeneral', () => {
  let component: QuestionGeneral;
  let fixture: ComponentFixture<QuestionGeneral>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionGeneral],
    }).compileComponents();

    fixture = TestBed.createComponent(QuestionGeneral);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
