import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuestionService, GroupedQuestions, Question } from 'src/app/services';
import { QuestionFormComponent } from 'src/app/features/admin/question-builder/question-form/question-form';

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
  imports: [CommonModule, QuestionFormComponent],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboardComponent implements OnInit {
  groupedQuestions: GroupedQuestions = {};
  sections: string[] = [];
  currentSection = '';
  expandedGroupKey: string | null = null;

  showQuestionForm = false;
  activeSection = '';
  activeSubsection = '';
  isNewGroup = false;
  isNewStep = false;
  editingQuestion: Question | null = null;

  constructor(
    private questionService: QuestionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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
        this.syncExpandedGroupForCurrentSection();
        this.cdr.detectChanges();
      },
      
    });
  }

  selectSection(section: string): void {
    this.currentSection = section;
    this.syncExpandedGroupForCurrentSection();
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

  openAddQuestion(subsectionKey: string): void {
    this.activeSection = this.currentSection;
    this.activeSubsection = subsectionKey;
    this.isNewGroup = false;
    this.isNewStep = false;
    this.editingQuestion = null;
    this.showQuestionForm = true;
  }

  openAddGroup(): void {
    this.activeSection = this.currentSection;
    this.activeSubsection = '';
    this.isNewGroup = true;
    this.isNewStep = false;
    this.editingQuestion = null;
    this.showQuestionForm = true;
  }

  openAddStep(): void {
    this.activeSection = '';
    this.activeSubsection = '';
    this.isNewGroup = false;
    this.isNewStep = true;
    this.editingQuestion = null;
    this.showQuestionForm = true;
  }

  editQuestion(q: Question): void {
    this.activeSection = q.section_key;
    this.activeSubsection = q.subsection_key;
    this.isNewGroup = false;
    this.isNewStep = false;
    this.editingQuestion = q;
    this.showQuestionForm = true;
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
      next: () => this.loadGroupedQuestions(),
      
    });
  }

  closeQuestionForm(): void {
    this.showQuestionForm = false;
    this.activeSection = '';
    this.activeSubsection = '';
    this.isNewGroup = false;
    this.isNewStep = false;
    this.editingQuestion = null;
  }

  onQuestionSaved(): void {
    this.loadGroupedQuestions();
    this.closeQuestionForm();
  }
}