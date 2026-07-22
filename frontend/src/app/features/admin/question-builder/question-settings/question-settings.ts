import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { QuestionService, Question } from 'src/app/services';

const CHOICE_TYPES = ['select', 'multi_select',  'radio', 'checkbox'];

export interface FieldTypeOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-question-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './question-settings.html',
  styleUrls: ['./question-settings.css'],
})
export class QuestionSettingsComponent implements OnChanges {
  @Input() question: Question | null = null;
  @Input() prefilledSection = '';
  @Input() prefilledSubsection = '';

  @Output() closeRequested = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();
  @Output() deleteRequested = new EventEmitter<Question>();

  form!: FormGroup;
  isSubmitting = false;

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

  constructor(
    private fb: FormBuilder,
    private questionService: QuestionService,
    private cdr: ChangeDetectorRef
  ) {
    this.buildForm();
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

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.form) return;
    if (changes['question']) {
      this.applyInitialValues();
    }
  }

  private buildForm(): void {
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
    this.cdr.detectChanges();
  }

  addOption(): void {
    this.options.push(this.fb.control('', Validators.required));
  }

  removeOption(index: number): void {
    this.options.removeAt(index);
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