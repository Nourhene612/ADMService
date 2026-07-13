import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionLogic } from './question-logic';

describe('QuestionLogic', () => {
  let component: QuestionLogic;
  let fixture: ComponentFixture<QuestionLogic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionLogic],
    }).compileComponents();

    fixture = TestBed.createComponent(QuestionLogic);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
