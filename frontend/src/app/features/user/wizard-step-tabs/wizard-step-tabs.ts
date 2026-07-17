import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WizardStateService } from 'src/app/services/wizard-state';

@Component({
  selector: 'app-wizard-step-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wizard-step-tabs.html',
  styleUrls: ['./wizard-step-tabs.css'],
})
export class WizardStepTabsComponent {
  @Input() steps: string[] = [];
  @Input() currentStepIndex = 0;

  constructor(private wizardState: WizardStateService) {}

  selectStep(index: number): void {
    this.wizardState.goToStep(index);
  }

  formatStepLabel(stepKey: string): string {
    return stepKey
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}