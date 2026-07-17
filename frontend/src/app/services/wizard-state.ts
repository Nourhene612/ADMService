import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import {
  AdmSessionService,
  AdmAssessmentSessionRead,
  AdmAssessmentSessionProgress,
  AdmAssessmentSessionStatus,
} from 'src/app/services/adm-session';

import {
  SessionQuestionService,
  SessionQuestion,
  GroupedSessionQuestions,
} from 'src/app/services/adm-session-question';

import {
  AdmAnswerService,
  AdmAssessmentAnswerBulkUpsertItem,
} from 'src/app/services/adm-answer';

export interface LocalAnswerValue {
  response_string?: string | null;
  response_number?: number | null;
  response_boolean?: boolean | null;
  response_list_json?: any;
  response_object_json?: any;
  answer_uid?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class WizardStateService {
  // ===== State interne =====
  private sessionSubject = new BehaviorSubject<AdmAssessmentSessionRead | null>(null);
  private questionsSubject = new BehaviorSubject<SessionQuestion[]>([]);
  private progressSubject = new BehaviorSubject<AdmAssessmentSessionProgress | null>(null);
  private currentStepIndexSubject = new BehaviorSubject<number>(0);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  private validationTriggerSubject = new BehaviorSubject<number>(0);

  // Empêche les appels start/load en double (SSR + hydration, ou double clic)
  private sessionRequestInFlight = false;

  private answersMap = new Map<string, LocalAnswerValue>();
  private dirtyQuestionUids = new Set<string>();

  // ===== Observables exposés =====
  session$ = this.sessionSubject.asObservable();
  questions$ = this.questionsSubject.asObservable();
  progress$ = this.progressSubject.asObservable();
  currentStepIndex$ = this.currentStepIndexSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();
  canSubmit$: Observable<boolean> = combineLatest([this.questions$, this.validationTriggerSubject.asObservable()]).pipe(
    map(([questions]) => this.computeCanSubmit(questions))
  );
  missingRequiredQuestions$: Observable<SessionQuestion[]> = combineLatest([
    this.questions$,
    this.validationTriggerSubject.asObservable(),
  ]).pipe(map(([questions]) => this.computeMissingRequiredQuestions(questions)));

  steps$: Observable<string[]> = this.questions$.pipe(
    map((questions) => {
      const seen = new Map<string, number>();
      for (const q of questions) {
        if (!seen.has(q.section_key)) {
          seen.set(q.section_key, q.display_order);
        } else {
          seen.set(q.section_key, Math.min(seen.get(q.section_key)!, q.display_order));
        }
      }
      return Array.from(seen.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([key]) => key);
    })
  );

  groupedQuestions$: Observable<GroupedSessionQuestions> = this.questions$.pipe(
    map((questions) => this.sessionQuestionService.groupQuestions(questions))
  );

  currentStepGroups$: Observable<{ [subsectionKey: string]: SessionQuestion[] }> = combineLatest([
    this.groupedQuestions$,
    this.steps$,
    this.currentStepIndex$,
  ]).pipe(
    map(([grouped, steps, index]) => {
      const stepKey = steps[index];
      return stepKey ? grouped[stepKey] || {} : {};
    })
  );

  constructor(
    private sessionService: AdmSessionService,
    private sessionQuestionService: SessionQuestionService,
    private answerService: AdmAnswerService
  ) {}

  // ======================================================
  // Helper : est-ce que la session courante peut être modifiée ?
  // ======================================================
  private canMutateSession(session: AdmAssessmentSessionRead | null): boolean {
    return !!session && session.status === AdmAssessmentSessionStatus.Draft;
  }

  isSessionEditable(): boolean {
    return this.canMutateSession(this.sessionSubject.value);
  }

  // ======================================================
  // Démarrage / chargement
  // ======================================================
  startNewSession(customerUid: string, assessmentType: string): void {
    if (this.sessionRequestInFlight) {
      console.warn('startNewSession ignoré : requête déjà en cours');
      return;
    }
    this.sessionRequestInFlight = true;
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    this.sessionService.start({ customer_uid: customerUid, assessment_type: assessmentType }).subscribe({
      next: (session) => {
        this.sessionSubject.next(session);
        this.loadQuestions(session.uid);
        this.loadProgress(session.uid);
        this.sessionRequestInFlight = false;
      },
      error: (err) => {
        this.sessionRequestInFlight = false;
        this.handleError(err);
      },
    });
  }

  loadExistingSession(sessionUid: string): void {
    if (this.sessionRequestInFlight) {
      console.warn('loadExistingSession ignoré : requête déjà en cours');
      return;
    }
    this.sessionRequestInFlight = true;
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    this.sessionService.get(sessionUid).subscribe({
      next: (session) => {
        this.sessionSubject.next(session);
        this.sessionRequestInFlight = false;

        if (session.status !== AdmAssessmentSessionStatus.Draft) {
          console.warn('Session chargée non modifiable, statut:', session.status);
          this.errorSubject.next(
            `Cette session est déjà "${session.status}" et ne peut plus être modifiée.`
          );
          this.loadingSubject.next(false);
          return;
        }

        this.loadQuestions(sessionUid);
        this.loadProgress(sessionUid);
      },
      error: (err) => {
        this.sessionRequestInFlight = false;
        this.handleError(err);
      },
    });
  }

  private loadQuestions(sessionUid: string): void {
    this.sessionQuestionService.getQuestionsForSession(sessionUid).subscribe({
      next: (res) => {
        this.answersMap.clear();
        this.questionsSubject.next(res.questions);

        for (const q of res.questions) {
          if (q.current_answer) {
            this.answersMap.set(q.uid, {
              response_string: q.current_answer.response_string,
              response_number: q.current_answer.response_number,
              response_boolean: q.current_answer.response_boolean,
              response_list_json: q.current_answer.response_list_json,
              response_object_json: q.current_answer.response_object_json,
              answer_uid: q.current_answer.uid,
            });
          }
        }
        this.validationTriggerSubject.next(this.validationTriggerSubject.value + 1);
        this.loadingSubject.next(false);
      },
      error: (err) => this.handleError(err),
    });
  }

  private loadProgress(sessionUid: string): void {
    this.sessionService.getProgress(sessionUid).subscribe({
      next: (progress) => this.progressSubject.next(progress),
      error: (err) => this.handleError(err),
    });
  }

  // ======================================================
  // Gestion des réponses (state local)
  // ======================================================
  getAnswerValue(questionUid: string): LocalAnswerValue | undefined {
    return this.answersMap.get(questionUid);
  }

  setAnswerValue(questionUid: string, value: LocalAnswerValue): void {
    if (!this.isSessionEditable()) {
      console.warn('Modification ignorée : session non modifiable');
      return;
    }
    const existing = this.answersMap.get(questionUid);
    this.answersMap.set(questionUid, { ...existing, ...value });
    this.dirtyQuestionUids.add(questionUid);
    this.validationTriggerSubject.next(this.validationTriggerSubject.value + 1);
    console.log('DIRTY SET:', Array.from(this.dirtyQuestionUids)); 
  }

  // ======================================================
  // Navigation entre steps
  // ======================================================
  getCurrentStepIndex(): number {
    return this.currentStepIndexSubject.value;
  }

  getStepCount(): number {
    return this.stepsSnapshot().length;
  }

  isOnFirstStep(): boolean {
    return this.getCurrentStepIndex() <= 0;
  }

  isOnLastStep(): boolean {
    const stepCount = this.getStepCount();
    return stepCount <= 0 || this.getCurrentStepIndex() >= stepCount - 1;
  }

  goToStep(index: number): void {
    const clampedIndex = this.clampStepIndex(index, this.getStepCount());
    this.currentStepIndexSubject.next(clampedIndex);
  }

  nextStep(): void {
    const nextIndex = this.getCurrentStepIndex() + 1;
    this.currentStepIndexSubject.next(this.clampStepIndex(nextIndex, this.getStepCount()));
  }

  previousStep(): void {
    this.currentStepIndexSubject.next(Math.max(0, this.getCurrentStepIndex() - 1));
  }

  private clampStepIndex(index: number, stepCount: number): number {
    if (!Number.isFinite(index)) {
      return 0;
    }
    const maxIndex = Math.max(stepCount - 1, 0);
    return Math.min(Math.max(index, 0), maxIndex);
  }

  private computeCanSubmit(questions: SessionQuestion[]): boolean {
    return this.computeMissingRequiredQuestions(questions).length === 0;
  }

  private computeMissingRequiredQuestions(questions: SessionQuestion[]): SessionQuestion[] {
    return questions.filter((question) => {
      if (!question.is_required || !question.is_visible) {
        return false;
      }
      return !this.hasValidAnswer(question.uid);
    });
  }

  private hasValidAnswer(questionUid: string): boolean {
    const value = this.answersMap.get(questionUid);
    if (!value) {
      return false;
    }

    if (value.response_string !== undefined && value.response_string !== null) {
      return value.response_string.trim() !== '';
    }
    if (value.response_number !== undefined && value.response_number !== null) {
      return true;
    }
    if (value.response_boolean !== undefined && value.response_boolean !== null) {
      return true;
    }
    if (value.response_list_json !== undefined && value.response_list_json !== null) {
      return this.isNonEmptyValue(value.response_list_json);
    }
    if (value.response_object_json !== undefined && value.response_object_json !== null) {
      return this.isNonEmptyValue(value.response_object_json);
    }
    return false;
  }

  private isNonEmptyValue(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim() !== '';
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return true;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return true;
  }

  // ======================================================
  // Sauvegarde (bulk-upsert + save-draft)
  // ======================================================
  saveDraft(): void {
    const session = this.sessionSubject.value;
    console.log('SAVE DRAFT called, session:', session?.uid, 'status:', session?.status);
    console.log('DIRTY UIDS:', Array.from(this.dirtyQuestionUids));

    if (!this.canMutateSession(session)) {
      console.warn('saveDraft ignoré : statut session =', session?.status);
      this.errorSubject.next(
        session
          ? `Impossible de sauvegarder : la session est "${session.status}".`
          : 'Aucune session active.'
      );
      return;
    }

    if (this.dirtyQuestionUids.size === 0) {
      this.persistCurrentStep(session!.uid);
      return;
    }

    const items: AdmAssessmentAnswerBulkUpsertItem[] = [];
    const questions = this.questionsSubject.value;

    for (const questionUid of this.dirtyQuestionUids) {
      const value = this.answersMap.get(questionUid);
      const question = questions.find((q) => q.uid === questionUid);
      if (!value || !question) continue;

      items.push({
        answer_uid: value.answer_uid ?? null,
        question_uid: questionUid,
        question_ref: question.question_ref,
        answer_type: question.answer_type,
        response_string: value.response_string ?? null,
        response_number: value.response_number ?? null,
        response_boolean: value.response_boolean ?? null,
        response_list_json: value.response_list_json ?? null,
        response_object_json: value.response_object_json ?? null,
      });
    }

    this.loadingSubject.next(true);

    this.answerService.bulkUpsert(session!.uid, { answers: items }).subscribe({
      next: (result) => {
        console.log('BULK UPSERT SUCCESS:', result);
        for (const created of result.created) {
          const value = this.answersMap.get(created.question_uid);
          if (value) value.answer_uid = created.uid;
        }
        for (const updated of result.updated) {
          const value = this.answersMap.get(updated.question_uid);
          if (value) value.answer_uid = updated.uid;
        }
        this.dirtyQuestionUids.clear();

        this.loadQuestions(session!.uid);
        this.persistCurrentStep(session!.uid);
      },
      error: (err) => {
        console.error('BULK UPSERT ERROR:', err); // ← AJOUTE CETTE LIGNE
        this.handleError(err);
      },
    });
  }

  private persistCurrentStep(sessionUid: string): void {
    const session = this.sessionSubject.value;
    if (!this.canMutateSession(session)) {
      this.loadingSubject.next(false);
      return;
    }

    const steps = this.stepsSnapshot();
    const currentStepKey = steps[this.currentStepIndexSubject.value] ?? null;

    this.sessionService
      .saveDraft(sessionUid, { current_step: currentStepKey })
      .subscribe({
        next: (updatedSession) => {
          this.sessionSubject.next(updatedSession);
          this.loadProgress(sessionUid);
          this.loadingSubject.next(false);
        },
        error: (err) => this.handleError(err),
      });
  }

  private stepsSnapshot(): string[] {
    const questions = this.questionsSubject.value;
    const seen = new Map<string, number>();
    for (const q of questions) {
      if (!seen.has(q.section_key)) seen.set(q.section_key, q.display_order);
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => key);
  }

  // ======================================================
  // Soumission finale
  // ======================================================
  submit(submittedBy: string): Observable<AdmAssessmentSessionRead> {
    const session = this.sessionSubject.value;
    if (!this.canMutateSession(session)) {
      console.warn('submit ignoré : statut session =', session?.status);
      this.errorSubject.next(
        session
          ? `Impossible de soumettre : la session est déjà "${session.status}".`
          : 'Aucune session active.'
      );
      return throwError(() => new Error('Session not editable'));
    }

    this.loadingSubject.next(true);
    console.log('CALLING BULK UPSERT with items:');
    return this.sessionService.submit(session!.uid, { submitted_by: submittedBy }).pipe(
      tap((updated) => {
        this.sessionSubject.next(updated);
        this.loadingSubject.next(false);
      }),
      catchError((err) => {
        this.handleError(err);
        return throwError(() => err);
      })
    );
  }

  cancel(reason: string, cancelledBy: string): Observable<AdmAssessmentSessionRead> {
    const session = this.sessionSubject.value;
    if (!this.canMutateSession(session)) {
      console.warn('cancel ignoré : statut session déjà =', session?.status);
      this.errorSubject.next(
        session
          ? `Cette session est déjà "${session.status}", elle ne peut pas être annulée à nouveau.`
          : 'Aucune session active.'
      );
      return throwError(() => new Error('Session not editable'));
    }

    return this.sessionService.cancel(session!.uid, { reason, cancelled_by: cancelledBy }).pipe(
      tap((updated) => {
        this.sessionSubject.next(updated);
      }),
      catchError((err) => {
        this.handleError(err);
        return throwError(() => err);
      })
    );
  }

  // ======================================================
  // Reset (utile pour repartir sur une nouvelle session proprement)
  // ======================================================
  reset(): void {
    this.sessionSubject.next(null);
    this.questionsSubject.next([]);
    this.progressSubject.next(null);
    this.currentStepIndexSubject.next(0);
    this.errorSubject.next(null);
    this.validationTriggerSubject.next(0);
    this.answersMap.clear();
    this.dirtyQuestionUids.clear();
    this.sessionRequestInFlight = false;
  }

  private handleError(err: any): void {
    console.error(err);
    this.errorSubject.next(err?.error?.detail || 'Une erreur est survenue.');
    this.loadingSubject.next(false);
  }
}