import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, FormArray, ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { CommonModule } from '@angular/common';

const CHOICE_TYPES = ['select', 'multi_select', 'radio', 'checkbox'];

export interface VisibilityCondition {
  question_ref: string;
  operator: string;
  value: string | string[] | null;
}

interface VisibilityQuestionOption {
  question_ref: string;
  question_text: string;
}

@Component({
  selector: 'app-question-general',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './question-general.html',
  styleUrls: ['./question-general.css']
})
export class QuestionGeneralComponent implements OnInit, OnChanges {
  @Input() form!: FormGroup;
  @Input() availableQuestions: { question_ref: string; question_text: string }[] = [];
  @Input() question: any | null = null;

  constructor(private fb: FormBuilder) {}

  answerTypes = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Text area' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date & time' },
    { value: 'select', label: 'Select' },
    { value: 'multi_select', label: 'Multi select' },
    { value: 'radio', label: 'Radio' },
    { value: 'checkbox', label: 'Checkbox' },
  ];

  conditionOperators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'gt', label: 'Greater than' },
    { value: 'lt', label: 'Less than' },
    { value: 'gte', label: 'Greater or equal' },
    { value: 'lte', label: 'Less or equal' },
    { value: 'in', label: 'Is one of' },
    { value: 'not_in', label: 'Is not one of' },
    { value: 'includes', label: 'Includes (multi-select)' },
    { value: 'not_includes', label: 'Does not include (multi-select)' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ];

  visibilityEnabled = false;
  visibilityGroup!: FormGroup;

  get filteredAvailableQuestions(): VisibilityQuestionOption[] {
    return this.availableQuestions.filter(
      (question) => question.question_ref !== this.question?.question_ref
    );
  }

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['form']) {
      this.setupVisibilityGroup();
    }

    if (changes['question']) {
      this.patchVisibilityFromQuestion(this.question);
    }
  }

  get options(): FormArray {
    return this.form.get('options') as FormArray;
  }

  get showOptions(): boolean {
    const type = this.form.get('answer_type')?.value;
    return CHOICE_TYPES.includes(type);
  }

  addOption(): void {
    this.options.push(this.fb.control('', Validators.required));
  }

  removeOption(index: number): void {
    this.options.removeAt(index);
  }

  private setupVisibilityGroup(): void {
    this.visibilityGroup = this.fb.group({
      question_ref: [null],
      operator: ['equals'],
      value: [''],
    });

    if (this.form.contains('visibility_condition')) {
      this.form.setControl('visibility_condition', this.visibilityGroup);
    } else {
      this.form.addControl('visibility_condition', this.visibilityGroup);
    }

    this.visibilityEnabled = false;
    this.patchVisibilityFromQuestion(this.question);
  }

  get conditionNeedsValue(): boolean {
    const op = this.visibilityGroup?.get('operator')?.value;
    return op !== 'is_empty' && op !== 'is_not_empty';
  }

  get conditionIsListOperator(): boolean {
    const op = this.visibilityGroup?.get('operator')?.value;
    return op === 'in' || op === 'not_in';
  }

  onToggleVisibility(event: Event): void {
    this.visibilityEnabled = (event.target as HTMLInputElement).checked;
    if (!this.visibilityEnabled) {
      this.visibilityGroup.reset({ question_ref: null, operator: 'equals', value: '' });
    }
  }

  private patchVisibilityFromQuestion(question: any): void {
    if (!this.visibilityGroup) return;
    const condition = question?.visibility_condition_json;
    this.visibilityEnabled = !!condition;
    if (condition) {
      this.visibilityGroup.patchValue({
        question_ref: condition.question_ref,
        operator: condition.operator,
        value: Array.isArray(condition.value) ? condition.value.join(', ') : (condition.value ?? ''),
      });
    } else {
      this.visibilityGroup.reset({ question_ref: null, operator: 'equals', value: '' });
    }
  }

  getVisibilityConditionPayload(): VisibilityCondition | null {
    if (!this.visibilityEnabled) return null;
    const raw = this.visibilityGroup.getRawValue();
    if (!raw.question_ref) return null;
    let value: any = typeof raw.value === 'string' ? raw.value.trim() : raw.value;
    if (this.conditionIsListOperator && typeof value === 'string') {
      value = value.split(',').map((v: string) => v.trim()).filter(Boolean);
    }
    return { question_ref: raw.question_ref, operator: raw.operator, value };
  }
}