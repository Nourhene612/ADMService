import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionRendererComponent } from './question-renderer';

describe('QuestionRendererComponent', () => {
  let component: QuestionRendererComponent;
  let fixture: ComponentFixture<QuestionRendererComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionRendererComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QuestionRendererComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
