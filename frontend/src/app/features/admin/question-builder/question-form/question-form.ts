import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
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
  @Input() allQuestions: Question[] = []; // Nouvel input pour toutes les questions disponibles

  @Output() closeRequested = new EventEmitter<void>();
  @Output() questionSaved = new EventEmitter<void>();

  questionForm!: FormGroup;
  isSubmitting = false;

  // Nouvelle propriété pour les questions disponibles dans le dropdown
  get availableQuestionsForDropdown() {
    if (!this.allQuestions || this.allQuestions.length === 0) {
      return [];
    }
    
    // Exclure la question en cours d'édition si elle existe
    const currentRef = this.editingQuestion?.question_ref;
    return this.allQuestions
      .filter(q => q.question_ref !== currentRef)
      .map(q => ({
        question_ref: q.question_ref,
        question_text: q.question_text
      }));
  }

  get isEditMode(): boolean {
    return !!this.editingQuestion;
  }

  constructor(
    private fb: FormBuilder,
    private questionService: QuestionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.applyInitialValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.questionForm) return;
    if (changes['editingQuestion'] || changes['allQuestions']) {
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
      options: this.fb.array([]),
      // Ajout du groupe de visibilité conditionnelle
      visibility_condition: this.fb.group({
        question_ref: [null],
        operator: ['equals'],
        value: ['']
      })
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

      // Remplir la condition de visibilité si elle existe
      const visibilityCondition = (q as any).visibility_condition_json;
      if (visibilityCondition) {
        this.questionForm.patchValue({
          visibility_condition: {
            question_ref: visibilityCondition.question_ref,
            operator: visibilityCondition.operator,
            value: Array.isArray(visibilityCondition.value) 
              ? visibilityCondition.value.join(', ') 
              : (visibilityCondition.value ?? '')
          }
        });
      }

      const existingOptions = (q as any).answer_options_json;
      this.setOptions(Array.isArray(existingOptions) ? existingOptions : []);
    } else {
      this.questionForm.patchValue({
        section_key: this.prefilledSection || '',
        subsection_key: this.prefilledSubsection || ''
      });
      this.setOptions([]);
    }
    this.cdr.detectChanges();
  }

  save(): void {
    if (this.isSubmitting) return;

    if (this.questionForm.invalid) {
      this.questionForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.isSubmitting = true;
    const formValue = this.questionForm.getRawValue();

    const isChoiceType = CHOICE_TYPES.includes(formValue.answer_type);
    const optionsPayload = isChoiceType && formValue.options?.length
      ? formValue.options.filter((o: string) => o?.trim()).map((o: string) => o.trim())
      : null;

    // Récupérer la condition de visibilité
    const visibilityCondition = formValue.visibility_condition;
    const visibilityPayload = (visibilityCondition?.question_ref && visibilityCondition.question_ref.trim()) 
      ? {
          question_ref: visibilityCondition.question_ref.trim(),
          operator: visibilityCondition.operator || 'equals',
          value: this.parseVisibilityValue(visibilityCondition.value, visibilityCondition.operator)
        }
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
      visibility_condition_json: visibilityPayload,
      created_by: 'frontend',
      updated_by: 'frontend'
    };

    const editing = this.editingQuestion;
    const request$ = editing && editing.uid
      ? this.questionService.updateQuestion(editing.uid, payload)
      : this.questionService.createQuestion(payload);

    request$.pipe(finalize(() => {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: () => {
        this.questionSaved.emit();
      },
      error: (err) => {
        console.error('Failed to save question', err);
        this.cdr.detectChanges();
      }
    });
  }

  // Méthode utilitaire pour parser la valeur de la condition
  private parseVisibilityValue(value: any, operator: string): string | string[] | null {
    if (!value) return null;
    
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (!trimmed) return null;

    const listOperators = ['in', 'not_in', 'includes', 'not_includes'];
    if (listOperators.includes(operator)) {
      return trimmed.split(',').map((v: string) => v.trim()).filter(Boolean);
    }
    
    return trimmed;
  }

  cancel(): void {
    this.closeRequested.emit();
  }
}