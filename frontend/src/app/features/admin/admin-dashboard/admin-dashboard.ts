import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { QuestionService, GroupedQuestions, Question } from 'src/app/services';
import { QuestionFormComponent } from 'src/app/features/admin/question-builder/question-form/question-form';
import { QuestionSettingsComponent } from 'src/app/features/admin/question-builder/question-settings/question-settings';
import { ConfirmationModalComponent } from 'src/app/features/user/assessment-wizard/confirmation-modal.component';

interface SubsectionGroup {
  subsectionKey: string;
  questions: Question[];
  expanded: boolean;
}

interface StepMeta {
  sectionKey: string;
  groupCount: number;
  questionCount: number;
  hasActiveQuestion: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, QuestionFormComponent, QuestionSettingsComponent, ConfirmationModalComponent],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboardComponent implements OnInit {
  groupedQuestions: GroupedQuestions = {};
  sections: string[] = [];
  currentSection = '';
  expandedGroupKey: string | null = null;
  lastUpdated: Date = new Date(); 

  // --- Modal (Add Step / Add Group uniquement) ---
  showQuestionForm = false;
  activeSection = '';
  activeSubsection = '';
  isNewGroup = false;
  isNewStep = false;

  // --- Panneau latéral "Question Settings" (toujours visible, 3e colonne) ---
  selectedQuestion: Question | null = null;
  settingsSection = '';
  settingsSubsection = '';

  // --- Popup de confirmation (delete/deactivate) ---
  modalOpenSubject = new BehaviorSubject<boolean>(false);
  modalOpen$ = this.modalOpenSubject.asObservable();
  modalTitle = '';
  modalMessage = '';
  modalType: 'success' | 'warning' | 'info' = 'info';

  constructor(
    private questionService: QuestionService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.loadGroupedQuestions();
  }

  loadGroupedQuestions(): void {
    this.questionService.getGroupedQuestions().subscribe({
      next: (data) => {
        this.groupedQuestions = data;
        this.sections = Object.keys(data);
        if (this.sections.length && !this.sections.includes(this.currentSection)) {
          this.currentSection = this.sections[0];
        }
        this.lastUpdated = new Date(); 
        this.syncExpandedGroupForCurrentSection();
        this.refreshSelectedQuestionAfterReload();
        this.cdr.detectChanges();
      },
    });
  }

  selectSection(section: string): void {
    this.currentSection = section;
    this.syncExpandedGroupForCurrentSection();
    this.autoSelectFirstQuestion();
  }

  private syncExpandedGroupForCurrentSection(): void {
    const sectionGroups = this.groupedQuestions[this.currentSection] || {};
    const subsectionKeys = Object.keys(sectionGroups);

    if (subsectionKeys.length === 0) {
      this.expandedGroupKey = null;
      return;
    }

    if (!this.expandedGroupKey || !subsectionKeys.includes(this.expandedGroupKey)) {
      this.expandedGroupKey = subsectionKeys[0];
    }
  }

  /** Sélectionne automatiquement la 1re question du groupe courant si rien n'est sélectionné. */
  private autoSelectFirstQuestion(): void {
    if (this.selectedQuestion) return;
    const groups = this.currentSectionGroups;
    const firstGroupWithQuestions = groups.find(g => g.questions.length > 0);
    const firstQuestion = firstGroupWithQuestions?.questions[0] ?? null;
    if (firstQuestion) {
      this.selectedQuestion = firstQuestion;
      this.settingsSection = firstQuestion.section_key;
      this.settingsSubsection = firstQuestion.subsection_key;
    }
  }

  /** Après reload (save/delete), réaligne la sélection sur la version fraîche de la question. */
  private refreshSelectedQuestionAfterReload(): void {
    if (this.selectedQuestion?.uid) {
      const sectionData = this.groupedQuestions[this.selectedQuestion.section_key] || {};
      const groupQuestions = sectionData[this.selectedQuestion.subsection_key] || [];
      const fresh = groupQuestions.find(q => q.uid === this.selectedQuestion!.uid);
      this.selectedQuestion = fresh ?? null;
    }
    if (!this.selectedQuestion) {
      this.autoSelectFirstQuestion();
    }
  }

  get stepsMeta(): StepMeta[] {
    return this.sections.map(sectionKey => {
      const subsections = this.groupedQuestions[sectionKey] || {};
      const allQuestions = Object.values(subsections).flat();
      return {
        sectionKey,
        groupCount: Object.keys(subsections).length,
        questionCount: allQuestions.length,
        hasActiveQuestion: allQuestions.some(q => q.is_active)
      };
    });
  }

  get currentSectionGroups(): SubsectionGroup[] {
    const sectionData = this.groupedQuestions[this.currentSection] || {};
    return Object.entries(sectionData).map(([subsectionKey, questions]) => ({
      subsectionKey,
      questions: [...questions].sort((a, b) => a.display_order - b.display_order),
      expanded: this.expandedGroupKey === subsectionKey
    }));
  }

  get currentStepDescription(): string | null {
    const sectionData = this.groupedQuestions[this.currentSection] || {};
    const allQuestions = Object.values(sectionData).flat();
    const description = allQuestions
      .map(question => question.question_description?.trim())
      .find((value): value is string => Boolean(value));

    return description ?? null;
  }

  toggleGroup(subsectionKey: string): void {
    this.expandedGroupKey = this.expandedGroupKey === subsectionKey ? null : subsectionKey;
  }

  get totalSteps(): number {
    return this.sections.length;
  }

  get totalQuestions(): number {
    return this.sections.reduce((sum, s) => sum + this.questionCountForSection(s), 0);
  }

  get requiredQuestions(): number {
    let count = 0;
    for (const section of this.sections) {
      const subsections = this.groupedQuestions[section] || {};
      for (const questions of Object.values(subsections)) {
        count += questions.filter(q => q.is_required).length;
      }
    }
    return count;
  }

  questionCountForSection(section: string): number {
    const subsections = this.groupedQuestions[section] || {};
    return Object.values(subsections).reduce((s, qs) => s + qs.length, 0);
  }

  // ---------- Question Settings (3e colonne) ----------

  selectQuestion(q: Question): void {
    this.selectedQuestion = q;
    this.settingsSection = q.section_key;
    this.settingsSubsection = q.subsection_key;
  }

  openAddQuestion(subsectionKey: string): void {
    this.selectedQuestion = null;
    this.settingsSection = this.currentSection;
    this.settingsSubsection = subsectionKey;
  }

  editQuestion(q: Question): void {
    this.selectQuestion(q);
  }

  closeSettingsPanel(): void {
    this.selectedQuestion = null;
    this.settingsSection = '';
    this.settingsSubsection = '';
  }

  onSettingsSaved(): void {
    this.loadGroupedQuestions();
  }

  onDeleteRequestedFromSettings(q: Question): void {
    this.deleteQuestion(q);
  }

  duplicateQuestion(q: Question): void {
    const { uid, ...rest } = q;
    const clone = {
      ...rest,
      question_ref: `${q.question_ref}_copy`,
      display_order: q.display_order + 1
    };
    this.questionService.createQuestion(clone).subscribe({
      next: () => this.loadGroupedQuestions(),
    });
  }

  deleteQuestion(q: Question): void {
    if (!q.uid) {
      return;
    }

    this.questionService.deleteQuestion(q.uid).subscribe({
      next: (result) => {
        if (result.deactivated) {
          this.openModal('Question désactivée', result.message, 'warning');
        } else {
          this.openModal('Question supprimée', result.message, 'success');
        }
        if (this.selectedQuestion?.uid === q.uid) {
          this.selectedQuestion = null;
        }
        this.loadGroupedQuestions();
      },
      error: (err) => {
        console.error('Erreur suppression question:', err);
        this.openModal('Erreur', 'Une erreur est survenue lors de la suppression.', 'warning');
      },
    });
  }

  closeModal(): void {
    this.modalOpenSubject.next(false);
  }

  private openModal(title: string, message: string, type: 'success' | 'warning' | 'info'): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.modalOpenSubject.next(true);
  }

  // ---------- Modal Add Step / Add Group ----------

  openAddGroup(): void {
    this.activeSection = this.currentSection;
    this.activeSubsection = '';
    this.isNewGroup = true;
    this.showQuestionForm = true;
  }

  openAddStep(): void {
    this.activeSection = '';
    this.activeSubsection = '';
    this.isNewGroup = false;
    this.showQuestionForm = true;
  }

  closeQuestionForm(): void {
    this.showQuestionForm = false;
    this.activeSection = '';
    this.activeSubsection = '';
    this.isNewGroup = false;
    this.isNewStep = false;
  }

  onQuestionSaved(): void {
    this.loadGroupedQuestions();
    this.closeQuestionForm();
  }
  openPreview(): void {
  window.open('/user', '_blank');
}
}