import { AdmAssessmentSessionStatus } from './adm-session';
import { WizardStateService } from './wizard-state';

describe('WizardStateService', () => {
  let service: WizardStateService;

  function createSpy(name: string) {
    return jasmine.createSpy(name);
  }

  beforeEach(() => {
    const sessionQuestionService = {
      getQuestionsForSession: createSpy('getQuestionsForSession'),
      groupQuestions: (questions: any[]) => {
        const grouped: Record<string, Record<string, any[]>> = {};
        const sorted = [...questions].sort((a, b) => a.display_order - b.display_order);

        for (const question of sorted) {
          const section = question.section_key;
          const subsection = question.subsection_key || 'default';
          grouped[section] ??= {};
          grouped[section][subsection] ??= [];
          grouped[section][subsection].push(question);
        }

        return grouped;
      },
    } as any;

    service = new WizardStateService(
      { start: createSpy('start'), get: createSpy('get'), getProgress: createSpy('getProgress'), saveDraft: createSpy('saveDraft'), submit: createSpy('submit'), cancel: createSpy('cancel') } as any,
      sessionQuestionService,
      { bulkUpsert: createSpy('bulkUpsert') } as any
    );
  });

  it('clamps navigation to the available step range', () => {
    (service as any).questionsSubject.next([
      { uid: 'q1', section_key: 'scope', display_order: 1 },
      { uid: 'q2', section_key: 'delivery', display_order: 2 },
    ]);

    service.goToStep(99);
    expect((service as any).currentStepIndexSubject.value).toBe(1);

    service.goToStep(-5);
    expect((service as any).currentStepIndexSubject.value).toBe(0);

    service.nextStep();
    expect((service as any).currentStepIndexSubject.value).toBe(1);

    service.nextStep();
    expect((service as any).currentStepIndexSubject.value).toBe(1);
  });

  it('computes canSubmit and missing required questions from visible required questions', () => {
    (service as any).sessionSubject.next({
      uid: 'session-1',
      status: AdmAssessmentSessionStatus.Draft,
      progress_percentage: 0,
      started_at: '',
      updated_at: '',
    });

    (service as any).questionsSubject.next([
      {
        uid: 'q-required',
        question_ref: 'ref-1',
        question_text: 'Required question',
        section_key: 'scope',
        display_order: 1,
        answer_type: 'text',
        is_required: true,
        version: 1,
        created_at: '',
        updated_at: '',
        is_visible: true,
        is_enabled: true,
        is_required_by_dependency: false,
      },
      {
        uid: 'q-optional',
        question_ref: 'ref-2',
        question_text: 'Optional question',
        section_key: 'scope',
        display_order: 2,
        answer_type: 'text',
        is_required: false,
        version: 1,
        created_at: '',
        updated_at: '',
        is_visible: true,
        is_enabled: true,
        is_required_by_dependency: false,
      },
      {
        uid: 'q-hidden',
        question_ref: 'ref-3',
        question_text: 'Hidden required question',
        section_key: 'scope',
        display_order: 3,
        answer_type: 'text',
        is_required: true,
        version: 1,
        created_at: '',
        updated_at: '',
        is_visible: false,
        is_enabled: true,
        is_required_by_dependency: false,
      },
    ]);

    let canSubmit = true;
    let missing: any[] = [];
    service.canSubmit$.subscribe((value) => (canSubmit = value));
    service.missingRequiredQuestions$.subscribe((value) => (missing = value));

    expect(canSubmit).toBeFalsy();
    expect(missing.map((q) => q.uid)).toEqual(['q-required']);

    service.setAnswerValue('q-required', { response_string: 'filled' });

    expect(canSubmit).toBeTruthy();
    expect(missing).toEqual([]);
  });

  it('recomputes conditional visibility immediately from local answers without saveDraft', () => {
    (service as any).sessionSubject.next({
      uid: 'session-1',
      status: AdmAssessmentSessionStatus.Draft,
      progress_percentage: 0,
      started_at: '',
      updated_at: '',
    });

    (service as any).questionsSubject.next([
      {
        uid: 'q-trigger',
        question_ref: 'trigger',
        question_text: 'Trigger question',
        section_key: 'scope',
        subsection_key: 'context',
        display_order: 1,
        answer_type: 'text',
        is_required: false,
        version: 1,
        created_at: '',
        updated_at: '',
        is_visible: true,
        is_enabled: true,
        is_required_by_dependency: false,
      },
      {
        uid: 'q-dependent',
        question_ref: 'dependent',
        question_text: 'Dependent question',
        section_key: 'scope',
        subsection_key: 'context',
        display_order: 2,
        answer_type: 'text',
        is_required: false,
        version: 1,
        created_at: '',
        updated_at: '',
        is_visible: false,
        is_enabled: true,
        is_required_by_dependency: false,
        visibility_condition_json: { question_ref: 'trigger', operator: 'equals', value: 'show' },
      },
    ]);

    let visibleQuestionUids: string[] = [];
    service.groupedQuestions$.subscribe((grouped) => {
      visibleQuestionUids = Object.values(grouped)
        .flatMap((subsection) => Object.values(subsection))
        .flat()
        .filter((question: any) => question.is_visible)
        .map((question: any) => question.uid);
    });

    service.setAnswerValue('q-trigger', { response_string: 'show' });

    expect(visibleQuestionUids).toContain('q-dependent');
  });
});
