import { Component, Input } from '@angular/core';
import { FormGroup, FormArray, ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { CommonModule } from '@angular/common';

const CHOICE_TYPES = ['select', 'multi_select', 'radio', 'checkbox'];

@Component({
  selector: 'app-question-general',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './question-general.html',
  styleUrls: ['./question-general.css']
})
export class QuestionGeneralComponent {
  @Input() form!: FormGroup;

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
}