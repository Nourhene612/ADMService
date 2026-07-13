import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

interface QuestionReference {
  question_uid: string;
  question_ref: string;
  question_text: string;
  display_order: number;
}

interface Operator {
  value: string;
  label: string;
}

@Component({
  selector: 'app-conditional-logic',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './question-logic.html',
  styleUrls: ['./question-logic.css']
})
export class ConditionalLogicComponent implements OnInit {
  @Input() form!: FormGroup;
  @Input() questions: QuestionReference[] = [];

  operators: Operator[] = [
    { value: 'eq', label: 'Equals' },
    { value: 'neq', label: 'Not equals' },
    { value: 'gt', label: 'Greater than' },
    { value: 'lt', label: 'Less than' },
    { value: 'gte', label: 'Greater or equal' },
    { value: 'lte', label: 'Less or equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ];

  modeDescription = 'The question is fully hidden from the form until the rule below is met.';

  showWarning = false;
  warningMessage = '';

  ngOnInit(): void {
    this.form.get('mode')?.valueChanges.subscribe(mode => {
      this.updateDescription(mode);
    });

    this.form.valueChanges.subscribe(() => {
      this.checkOrderWarning();
    });
  }

  updateDescription(mode: string) {
    if (mode === 'visibility') {
      this.modeDescription =
        'The question is fully hidden from the form until the rule below is met.';
    } else {
      this.modeDescription =
        'The question becomes required only if the condition is satisfied.';
    }
  }

  checkOrderWarning() {
    const selectedUid = this.form.get('condition_question_uid')?.value;
    const currentOrder = this.form.get('current_order')?.value;

    const selectedQuestion = this.questions.find(q => q.question_uid === selectedUid);

    if (!selectedQuestion) {
      this.showWarning = false;
      return;
    }

    if (selectedQuestion.display_order > currentOrder) {
      this.showWarning = true;
      this.warningMessage =
        `"${selectedQuestion.question_text}" has a display order higher than this question. Adjust order first.`;
    } else {
      this.showWarning = false;
    }
  }

  fixOrder() {
    const selectedUid = this.form.get('condition_question_uid')?.value;
    const selectedQuestion = this.questions.find(q => q.question_uid === selectedUid);

    if (selectedQuestion) {
      this.form.patchValue({
        current_order: selectedQuestion.display_order + 1
      });
    }
  }
}