import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SessionQuestion } from 'src/app/services/adm-session-question';
import { WizardStateService, LocalAnswerValue } from 'src/app/services/wizard-state';

@Component({
  selector: 'app-question-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './question-renderer.html',
  styleUrls: ['./question-renderer.css'],
})
export class QuestionRendererComponent implements OnInit {
  @Input() question!: SessionQuestion;

  // Valeurs locales liées au template via ngModel
  textValue = '';
  numberValue: number | null = null;
  booleanValue: boolean | null = null;
  selectedOption: string | null = null;      // single_select / radio_card
  selectedOptions: string[] = [];             // multi_select (chips)

  constructor(private wizardState: WizardStateService) {}

  ngOnInit(): void {
    const existing = this.wizardState.getAnswerValue(this.question.uid);
    if (!existing) return;

    this.textValue = existing.response_string ?? '';
    this.numberValue = existing.response_number ?? null;
    this.booleanValue = existing.response_boolean ?? null;
    this.selectedOption = existing.response_string ?? null;
    this.selectedOptions = Array.isArray(existing.response_list_json)
      ? existing.response_list_json
      : [];
  }

  get options(): string[] {
    if (!this.question.answer_options_json) {
      return [];
    }

    // Si c'est déjà un tableau, le retourner directement
    if (Array.isArray(this.question.answer_options_json)) {
      return this.question.answer_options_json;
    }

    // Si c'est une string JSON, la parser
    if (typeof this.question.answer_options_json === 'string') {
      try {
        const parsed = JSON.parse(this.question.answer_options_json);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.error(`Failed to parse answer_options_json for question ${this.question.uid}:`, error);
        return [];
      }
    }

    return [];
  }

  // ===== Handlers par type =====
  onTextChange(value: string): void {
    this.updateAnswer({ response_string: value });
  }

  onNumberChange(value: number): void {
    this.updateAnswer({ response_number: value });
  }

  onBooleanChange(value: boolean): void {
    this.updateAnswer({ response_boolean: value });
  }

  onSingleSelectChange(value: string): void {
    this.selectedOption = value;
    this.updateAnswer({ response_string: value });
  }

  toggleMultiSelectOption(option: string): void {
    const index = this.selectedOptions.indexOf(option);
    if (index === -1) {
      this.selectedOptions = [...this.selectedOptions, option];
    } else {
      this.selectedOptions = this.selectedOptions.filter((o) => o !== option);
    }
    this.updateAnswer({ response_list_json: this.selectedOptions });
  }

  removeChip(option: string): void {
    this.selectedOptions = this.selectedOptions.filter((o) => o !== option);
    this.updateAnswer({ response_list_json: this.selectedOptions });
  }

  private updateAnswer(value: LocalAnswerValue): void {
    this.wizardState.setAnswerValue(this.question.uid, value);
  }
}
