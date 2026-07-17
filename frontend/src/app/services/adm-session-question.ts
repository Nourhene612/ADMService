import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ===== Types (correspond à QuestionDetailResponse du back) =====
export interface QuestionAnswerResponse {
  uid?: string | null;
  response_string?: string | null;
  response_number?: number | null;
  response_boolean?: boolean | null;
  response_list_json?: any;
  response_object_json?: any;
  is_valid: boolean;
  answered_at?: string | null;
}

export interface SessionQuestion {
  uid: string;
  question_ref: string;
  question_text: string;
  question_description?: string | null;
  section_key: string;             // = Step (onglet du wizard)
  subsection_key?: string | null;  // = Group (wizard-group-card)
  display_order: number;
  answer_type: string;
  answer_condition?: string | null;
  answer_options_json?: any;
  answer_unit_json?: any;
  dependency_json?: any;
  input_placeholder?: string | null;
  help_text?: string | null;
  validation_rules_json?: any;
  visibility_condition_json?: any;
  default_value_json?: any;
  is_required: boolean;
  score_weight?: number;
  version: number;
  created_at: string;
  updated_at: string;

  // Champs dynamiques calculés par le back pour CETTE session
  current_answer?: QuestionAnswerResponse | null;
  is_visible: boolean;
  is_enabled: boolean;
  is_required_by_dependency: boolean;
}

export interface QuestionsForSessionResponse {
  session_uid: string;
  questions: SessionQuestion[];
}

// Groupement calculé côté front pour le wizard (section_key -> subsection_key -> questions)
export type GroupedSessionQuestions = {
  [sectionKey: string]: {
    [subsectionKey: string]: SessionQuestion[];
  };
};

@Injectable({
  providedIn: 'root'
})
export class SessionQuestionService {

  private apiUrl = 'http://localhost:8000/api/adm-assessment/sessions';

  constructor(private http: HttpClient) {}

  getQuestionsForSession(sessionUid: string): Observable<QuestionsForSessionResponse> {
    return this.http.get<QuestionsForSessionResponse>(`${this.apiUrl}/${sessionUid}/questions`);
  }

  /**
   * Groupe les questions plates par section_key puis subsection_key,
   * triées par display_order, pour alimenter directement
   * wizard-step-tabs -> wizard-group-card -> question-renderer
   */
  groupQuestions(questions: SessionQuestion[]): GroupedSessionQuestions {
    const grouped: GroupedSessionQuestions = {};

    const sorted = [...questions].sort((a, b) => a.display_order - b.display_order);

    for (const q of sorted) {
      const section = q.section_key;
      const subsection = q.subsection_key || 'default';

      if (!grouped[section]) {
        grouped[section] = {};
      }
      if (!grouped[section][subsection]) {
        grouped[section][subsection] = [];
      }
      grouped[section][subsection].push(q);
    }

    return grouped;
  }
}