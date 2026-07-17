import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


// ===== Types =====
export interface AdmAssessmentAnswerBase {
  question_uid: string;
  question_ref?: string | null;
  answer_type: string;
  answer_unit?: string | null;

  response_string?: string | null;
  response_number?: number | null;
  response_boolean?: boolean | null;
  response_list_json?: any;
  response_object_json?: any;

  answer_qualifier?: string | null;
}

export interface AdmAssessmentAnswerCreate extends AdmAssessmentAnswerBase {}
export interface AdmAssessmentAnswerUpdate extends AdmAssessmentAnswerBase {}

export interface AdmAssessmentAnswerBulkUpsertItem extends AdmAssessmentAnswerBase {
  answer_uid?: string | null; // présent = update, absent = create
}

export interface AdmAssessmentAnswerBulkUpsert {
  answers: AdmAssessmentAnswerBulkUpsertItem[];
}

export interface AdmAssessmentAnswerRead {
  uid: string;
  session_uid: string;
  question_uid: string;
  answer_type: string;
  answer_unit?: string | null;

  response_string?: string | null;
  response_number?: number | null;
  response_boolean?: boolean | null;
  response_list_json?: any;
  response_object_json?: any;

  answer_qualifier?: string | null;

  is_valid: boolean;
  validation_error?: string | null;

  answered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdmAssessmentAnswerBulkUpsertResult {
  created: AdmAssessmentAnswerRead[];
  updated: AdmAssessmentAnswerRead[];
  errors: any[];
}

// ===== Service =====
@Injectable({ providedIn: 'root' })
export class AdmAnswerService {
  private apiUrl = 'http://localhost:8000/api/adm-assessment/sessions';;

  constructor(private http: HttpClient) {}

  list(sessionUid: string): Observable<AdmAssessmentAnswerRead[]> {
    return this.http.get<AdmAssessmentAnswerRead[]>(`${this.apiUrl}/${sessionUid}/answers`);
  }

  get(sessionUid: string, answerUid: string): Observable<AdmAssessmentAnswerRead> {
    return this.http.get<AdmAssessmentAnswerRead>(`${this.apiUrl}/${sessionUid}/answers/${answerUid}`);
  }

  create(sessionUid: string, payload: AdmAssessmentAnswerCreate): Observable<AdmAssessmentAnswerRead> {
    return this.http.post<AdmAssessmentAnswerRead>(`${this.apiUrl}/${sessionUid}/answers`, payload);
  }

  bulkUpsert(sessionUid: string, payload: AdmAssessmentAnswerBulkUpsert): Observable<AdmAssessmentAnswerBulkUpsertResult> {
    return this.http.post<AdmAssessmentAnswerBulkUpsertResult>(
      `${this.apiUrl}/${sessionUid}/answers/bulk-upsert`,
      payload
    );
  }

  update(sessionUid: string, answerUid: string, payload: AdmAssessmentAnswerUpdate): Observable<AdmAssessmentAnswerRead> {
    return this.http.put<AdmAssessmentAnswerRead>(`${this.apiUrl}/${sessionUid}/answers/${answerUid}`, payload);
  }

  delete(sessionUid: string, answerUid: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${sessionUid}/answers/${answerUid}`);
  }
}