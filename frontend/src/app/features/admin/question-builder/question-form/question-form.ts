import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { QuestionService, Question } from 'src/app/services';
import { QuestionGeneralComponent } from '../question-general/question-general';

const CHOICE_TYPES = ['select', 'multi_select', 'radio', 'checkbox'];

@Component({
  selector: 'app-question-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QuestionGeneralComponent],
  templateUrl: './question-form.html',
  styleUrls: ['./question-form.css']
})
export class QuestionFormComponent implements OnInit, OnChanges {
  @Input() prefilledSection = '';
  @Input() prefilledSubsection = '';
  @Input() isNewGroup = false;
  @Input() editingQuestion: Question | null = null;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() questionSaved = new EventEmitter<void>();

  questionForm!: FormGroup;
  isSubmitting = false;

  get isEditMode(): boolean {
    return !!this.editingQuestion;
  }

  constructor(
    private fb: FormBuilder,
    private questionService: QuestionService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.applyInitialValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.questionForm) return;
    if (changes['editingQuestion']) {
      this.applyInitialValues();
    }
  }

  private buildForm(): void {
    this.questionForm = this.fb.group({
      question_ref: ['', Validators.required],
      section_key: [''],
      subsection_key: [''],
      question_text: ['', Validators.required],
      answer_type: ['text', Validators.required],
      placeholder: [''],
      default_value: [''],
      description: [''],
      order: [0, [Validators.required, Validators.min(0)]],
      weight: [0],
      active: [true],
      required: [false],
      options: this.fb.array([])
    });
  }

  private setOptions(values: string[]): void {
    const optionsArray = this.fb.array(
      values.map(v => this.fb.control(v, Validators.required))
    );
    this.questionForm.setControl('options', optionsArray);
  }

  private applyInitialValues(): void {
    if (this.editingQuestion) {
      const q = this.editingQuestion;
      this.questionForm.patchValue({
        question_ref: q.question_ref,
        section_key: q.section_key,
        subsection_key: q.subsection_key,
        question_text: q.question_text,
        answer_type: q.answer_type,
        placeholder: q.input_placeholder ?? '',
        default_value: q.default_value_json ?? '',
        description: q.question_description ?? '',
        order: q.display_order,
        weight: q.score_weight ?? 0,
        active: q.is_active,
        required: q.is_required
      });

      const existingOptions = (q as any).answer_options_json;
      this.setOptions(Array.isArray(existingOptions) ? existingOptions : []);
    } else {
      this.questionForm.patchValue({
        section_key: this.prefilledSection || '',
        subsection_key: this.prefilledSubsection || ''
      });
      this.setOptions([]);
    }
  }

  save(): void {
    if (this.isSubmitting) return;

    if (this.questionForm.invalid) {
      this.questionForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formValue = this.questionForm.getRawValue();

    const isChoiceType = CHOICE_TYPES.includes(formValue.answer_type);
const optionsPayload = isChoiceType && formValue.options?.length
  ? formValue.options.filter((o: string) => o?.trim()).map((o: string) => o.trim())
  : null;

    const payload = {
      question_ref: formValue.question_ref?.trim(),
      question_text: formValue.question_text?.trim(),
      question_description: formValue.description?.trim() || null,
      section_key: formValue.section_key?.trim() || 'default',
      subsection_key: formValue.subsection_key?.trim() || 'default',
      display_order: Number(formValue.order ?? 0),
      answer_type: formValue.answer_type || 'text',
      input_placeholder: formValue.placeholder?.trim() || null,
      default_value_json: formValue.default_value !== '' ? formValue.default_value : null,
      answer_options_json: optionsPayload,
      is_required: Boolean(formValue.required),
      is_active: Boolean(formValue.active),
      score_weight: Number(formValue.weight ?? 0),
      created_by: 'frontend',
      updated_by: 'frontend'
    };

    const editing = this.editingQuestion;
    const request$ = editing && editing.uid
      ? this.questionService.updateQuestion(editing.uid, payload)
      : this.questionService.createQuestion(payload);

    request$.pipe(finalize(() => {
      this.isSubmitting = false;
    })).subscribe({
      next: () => {
        this.questionSaved.emit();
      },
      error: (err) => {
        console.error('Failed to save question', err);
      }
    });
  }

  cancel(): void {
    this.closeRequested.emit();
  }
}