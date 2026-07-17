import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompletionScoreComponent } from './completion-score';

describe('CompletionScoreComponent', () => {
  let component: CompletionScoreComponent;
  let fixture: ComponentFixture<CompletionScoreComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompletionScoreComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CompletionScoreComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
