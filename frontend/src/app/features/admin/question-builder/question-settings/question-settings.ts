import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, Subject, combineLatest, of } from 'rxjs';
import { catchError, finalize, map, startWith, takeUntil } from 'rxjs/operators';
import { QuestionService, Question } from 'src/app/services';

const CHOICE_TYPES = ['select', 'multi_select', 'radio', 'checkbox'];

export interface FieldTypeOption {
  value: string;
  label: string;
}

interface VisibilityQuestionOption {
  uid: string;
  question_ref: string;
  question_text: string;
}

@Component({
  selector: 'app-question-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './question-settings.html',
  styleUrls: ['./question-settings.css'],
})
export class QuestionSettingsComponent implements OnChanges, OnInit, OnDestroy {
  @Input() question: Question | null = null;
  @Input() prefilledSection = '';
  @Input() prefilledSubsection = '';
  @Input() availableQuestions: { question_ref: string; question_text: string }[] = [];

  @Output() closeRequested = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();
  @Output() deleteRequested = new EventEmitter<Question>();

  form!: FormGroup;
  isSubmitting = false;

  visibilityEnabled = false;
  visibilityGroup!: FormGroup;
  visibilityQuestionSearchControl = new FormControl('', { nonNullable: true });
  visibilityQuestionDropdownOpen = false;

  private readonly destroy$ = new Subject<void>();
  private readonly availableQuestionsSubject = new BehaviorSubject<VisibilityQuestionOption[]>([]);
  private readonly currentQuestionUidSubject = new BehaviorSubject<string | null>(null);

  filteredVisibilityQuestions$ = combineLatest([
    this.availableQuestionsSubject.asObservable(),
    this.visibilityQuestionSearchControl.valueChanges.pipe(startWith('')),
    this.currentQuestionUidSubject.asObservable(),
  ]).pipe(
    map(([questions, searchText, currentQuestionUid]) => {
      const normalizedSearch = searchText.trim().toLowerCase();

      return questions.filter((question) => {
        if (currentQuestionUid && question.uid === currentQuestionUid) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const refMatch = question.question_ref.toLowerCase().includes(normalizedSearch);
        const textMatch = question.question_text.toLowerCase().includes(normalizedSearch);
        return refMatch || textMatch;
      });
    })
  );

  fieldTypes: FieldTypeOption[] = [
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

  constructor(
    private fb: FormBuilder,
    private questionService: QuestionService,
    private cdr: ChangeDetectorRef
  ) {
    this.buildForm();
  }

  ngOnInit(): void {
    this.loadAvailableQuestions();
  }

  get isEditMode(): boolean {
    return !!this.question;
  }

  get options(): FormArray {
    return this.form.get('options') as FormArray;
  }

  get isChoiceType(): boolean {
    return CHOICE_TYPES.includes(this.form?.get('answer_type')?.value);
  }

  get conditionNeedsValue(): boolean {
    const op = this.visibilityGroup?.get('operator')?.value;
    return op !== 'is_empty' && op !== 'is_not_empty';
  }

  get conditionIsListOperator(): boolean {
    const op = this.visibilityGroup?.get('operator')?.value;
    return op === 'in' || op === 'not_in';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.form) return;
    if (changes['question']) {
      this.currentQuestionUidSubject.next(this.question?.uid ?? null);
      this.applyInitialValues();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.availableQuestionsSubject.complete();
    this.currentQuestionUidSubject.complete();
  }

  private buildForm(): void {
    this.visibilityGroup = this.fb.group({
      question_ref: [null],
      operator: ['equals'],
      value: [''],
    });

    this.form = this.fb.group({
      question_ref: ['', Validators.required],
      section_key: [''],
      subsection_key: [''],
      question_text: ['', Validators.required],
      help_text: [''],
      answer_type: ['text', Validators.required],
      placeholder: [''],
      order: [0, [Validators.required, Validators.min(0)]],
      weight: [0],
      is_active: [true],
      is_required: [false],
      allow_other: [false],
      options: this.fb.array([]),
    });
  }

  private setOptions(values: string[]): void {
    const optionsArray = this.fb.array(
      values.map((v) => this.fb.control(v, Validators.required))
    );
    this.form.setControl('options', optionsArray);
  }

  private loadAvailableQuestions(): void {
    this.questionService
      .getQuestions()
      .pipe(
        map((questions) =>
          questions
            .filter((question) => !!question?.uid)
            .map((question) => ({
              uid: question.uid,
              question_ref: question.question_ref,
              question_text: question.question_text,
            }))
        ),
        catchError((error) => {
          console.error('Failed to load questions for visibility picker', error);
          return of([] as VisibilityQuestionOption[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((questions) => {
        this.availableQuestions = questions;
        this.availableQuestionsSubject.next(questions);
        this.syncVisibilityQuestionSearchValue();
      });
  }

  private formatQuestionLabel(question: VisibilityQuestionOption): string {
    return `${question.question_ref} — ${question.question_text}`;
  }

  private syncVisibilityQuestionSearchValue(): void {
    const selectedQuestionRef = this.visibilityGroup?.get('question_ref')?.value;

    if (!selectedQuestionRef) {
      this.visibilityQuestionSearchControl.setValue('', { emitEvent: false });
      return;
    }

    const selectedQuestion = this.availableQuestionsSubject.value.find(
      (question) => question.question_ref === selectedQuestionRef
    );

    this.visibilityQuestionSearchControl.setValue(
      selectedQuestion ? this.formatQuestionLabel(selectedQuestion) : selectedQuestionRef,
      { emitEvent: false }
    );
  }

  onToggleVisibility(event: Event): void {
    this.visibilityEnabled = (event.target as HTMLInputElement).checked;
    if (!this.visibilityEnabled) {
      this.visibilityGroup.reset({ question_ref: null, operator: 'equals', value: '' });
      this.visibilityQuestionSearchControl.setValue('', { emitEvent: false });
      this.visibilityQuestionDropdownOpen = false;
    }
  }

  private patchVisibilityFromQuestion(question: Question | null): void {
    const condition = (question as any)?.visibility_condition_json;
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
    this.syncVisibilityQuestionSearchValue();
  }

  private applyInitialValues(): void {
    if (this.question) {
      const q = this.question;
      this.form.patchValue({
        question_ref: q.question_ref,
        section_key: q.section_key,
        subsection_key: q.subsection_key,
        question_text: q.question_text,
        help_text: (q as any).help_text ?? '',
        answer_type: q.answer_type,
        placeholder: q.input_placeholder ?? '',
        order: q.display_order,
        weight: q.score_weight ?? 0,
        is_active: q.is_active,
        is_required: q.is_required,
        allow_other: (q as any).allow_other ?? false,
      });

      const existingOptions = (q as any).answer_options_json;
      this.setOptions(Array.isArray(existingOptions) ? existingOptions : []);
    } else {
      this.form.reset({
        question_ref: '',
        section_key: this.prefilledSection || '',
        subsection_key: this.prefilledSubsection || '',
        question_text: '',
        help_text: '',
        answer_type: 'text',
        placeholder: '',
        order: 0,
        weight: 0,
        is_active: true,
        is_required: false,
        allow_other: false,
      });
      this.setOptions([]);
    }
    this.patchVisibilityFromQuestion(this.question);
    this.cdr.detectChanges();
  }

  addOption(): void {
    this.options.push(this.fb.control('', Validators.required));
  }

  removeOption(index: number): void {
    this.options.removeAt(index);
  }

  private buildVisibilityPayload(): any | null {
    if (!this.visibilityEnabled) return null;
    const raw = this.visibilityGroup.getRawValue();
    if (!raw.question_ref) return null;
    let value: any = typeof raw.value === 'string' ? raw.value.trim() : raw.value;
    if (this.conditionIsListOperator && typeof value === 'string') {
      value = value.split(',').map((v: string) => v.trim()).filter(Boolean);
    }
    return { question_ref: raw.question_ref, operator: raw.operator, value };
  }

  openVisibilityQuestionDropdown(): void {
    if (!this.visibilityEnabled) {
      return;
    }

    this.visibilityQuestionDropdownOpen = true;
  }

  closeVisibilityQuestionDropdown(): void {
    window.setTimeout(() => {
      this.visibilityQuestionDropdownOpen = false;
    }, 120);
  }

  selectVisibilityQuestion(question: VisibilityQuestionOption): void {
    this.visibilityGroup.patchValue({ question_ref: question.question_ref });
    this.visibilityQuestionSearchControl.setValue(this.formatQuestionLabel(question), { emitEvent: false });
    this.visibilityQuestionDropdownOpen = false;
  }

  save(): void {
    if (this.isSubmitting) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.isSubmitting = true;
    const formValue = this.form.getRawValue();

    const optionsPayload =
      this.isChoiceType && formValue.options?.length
        ? formValue.options.filter((o: string) => o?.trim()).map((o: string) => o.trim())
        : null;

    const payload = {
      question_ref: formValue.question_ref?.trim(),
      question_text: formValue.question_text?.trim(),
      help_text: formValue.help_text?.trim() || null,
      section_key: formValue.section_key?.trim() || 'default',
      subsection_key: formValue.subsection_key?.trim() || 'default',
      display_order: Number(formValue.order ?? 0),
      answer_type: formValue.answer_type || 'text',
      input_placeholder: formValue.placeholder?.trim() || null,
      answer_options_json: optionsPayload,
      is_required: Boolean(formValue.is_required),
      is_active: Boolean(formValue.is_active),
      score_weight: Number(formValue.weight ?? 0),
      allow_other: Boolean(formValue.allow_other),
      visibility_condition_json: this.buildVisibilityPayload(),
    };

    const editing = this.question;
    const request$ =
      editing && editing.uid
        ? this.questionService.updateQuestion(editing.uid, payload)
        : this.questionService.createQuestion(payload);

    request$.pipe(finalize(() => {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: () => {
        this.saved.emit();
      },
      error: (err) => {
        console.error('Failed to save question', err);
        this.cdr.detectChanges();
      },
    });
  }

  onDelete(): void {
    if (this.question) {
      this.deleteRequested.emit(this.question);
    }
  }

  cancel(): void {
    this.closeRequested.emit();
  }
}