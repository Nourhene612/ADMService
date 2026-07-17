import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


// ===== Types =====
export enum AdmAssessmentSessionStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Cancelled = 'cancelled',
  Expired = 'expired',
}

export interface AdmAssessmentSessionCreate {
  customer_uid: string;
  company_uid?: string | null;
  assessment_type: string;
  metadata_json?: any;
}

export interface AdmAssessmentSessionSaveDraft {
  current_step?: string | null;
  completed_steps_json?: string[] | null;
  metadata_json?: any;
}

export interface AdmAssessmentSessionSubmit {
  submitted_by: string;
}

export interface AdmAssessmentSessionCancel {
  reason?: string | null;
  cancelled_by?: string | null;
}

export interface AdmAssessmentSessionRead {
  uid: string;
  customer_uid: string;
  company_uid?: string | null;
  assessment_type: string;
  status: AdmAssessmentSessionStatus;
  current_step?: string | null;
  progress_percentage: number;
  completed_steps_json?: string[] | null;
  submitted_by?: string | null;
  metadata_json?: any;
  started_at: string;
  updated_at: string;
  submitted_at?: string | null;
  expires_at?: string | null;
}

export interface AdmAssessmentSessionProgress {
  session_uid: string;
  status: AdmAssessmentSessionStatus;
  current_step?: string | null;
  progress_percentage: number;
  completed_steps: string[];
  total_questions: number;
  answered_questions: number;
  remaining_questions: number;
}

export interface AdmAssessmentSessionSummary {
  uid: string;
  assessment_type: string;
  status: AdmAssessmentSessionStatus;
  progress_percentage: number;
  started_at: string;
  submitted_at?: string | null;
}

// ===== Service =====
@Injectable({ providedIn: 'root' })
export class AdmSessionService {
   private apiUrl = 'http://localhost:8000/api/adm-assessment/sessions';;

  constructor(private http: HttpClient) {}

  start(payload: AdmAssessmentSessionCreate): Observable<AdmAssessmentSessionRead> {
    return this.http.post<AdmAssessmentSessionRead>(`${this.apiUrl}/start`, payload);
  }

  get(sessionUid: string): Observable<AdmAssessmentSessionRead> {
    return this.http.get<AdmAssessmentSessionRead>(`${this.apiUrl}/${sessionUid}`);
  }

  getProgress(sessionUid: string): Observable<AdmAssessmentSessionProgress> {
    return this.http.get<AdmAssessmentSessionProgress>(`${this.apiUrl}/${sessionUid}/progress`);
  }

  saveDraft(sessionUid: string, payload: AdmAssessmentSessionSaveDraft): Observable<AdmAssessmentSessionRead> {
    return this.http.post<AdmAssessmentSessionRead>(`${this.apiUrl}/${sessionUid}/save-draft`, payload);
  }

  submit(sessionUid: string, payload: AdmAssessmentSessionSubmit): Observable<AdmAssessmentSessionRead> {
    return this.http.post<AdmAssessmentSessionRead>(`${this.apiUrl}/${sessionUid}/submit`, payload);
  }

  cancel(sessionUid: string, payload: AdmAssessmentSessionCancel): Observable<AdmAssessmentSessionRead> {
    return this.http.post<AdmAssessmentSessionRead>(`${this.apiUrl}/${sessionUid}/cancel`, payload);
  }
}