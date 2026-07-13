import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

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

  answerTypes = [
    {
      value: 'number',
      label: 'Number'
    },
    {
      value: 'text',
      label: 'Text'
    },
    {
      value: 'textarea',
      label: 'Text area'
    },
    {
      value: 'select',
      label: 'Select'
    },
    {
      value: 'multi_select',
      label: 'Multi select'
    },
    {
      value: 'radio',
      label: 'Radio'
    },
    {
      value: 'checkbox',
      label: 'Checkbox'
    }
  ];

}
