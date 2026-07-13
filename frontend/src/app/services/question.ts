import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Question {
  uid: string;
  question_ref: string;
  question_text: string;
  question_description?: string | null;
  section_key: string;
  subsection_key: string;
  display_order: number;
  answer_type: string;
  input_placeholder?: string | null;
  default_value_json?: any;
  is_required: boolean;
  is_active: boolean;
  score_weight: number;
}

export type GroupedQuestions = {
  [sectionKey: string]: {
    [subsectionKey: string]: Question[];
  };
};

@Injectable({
  providedIn: 'root'
})
export class QuestionService {

  private apiUrl = 'http://localhost:8000/api/adm-assessment/admin/questions';

  constructor(private http: HttpClient) {}

  getQuestions(): Observable<Question[]> {
    return this.http.get<Question[]>(this.apiUrl);
  }

  getGroupedBySection(): Observable<GroupedQuestions> {
    return this.http.get<GroupedQuestions>(`${this.apiUrl}/grouped-by-section`);
  }

  getGroupedQuestions(): Observable<GroupedQuestions> {
    return this.getGroupedBySection();
  }

  getQuestionById(questionUid: string): Observable<Question> {
    return this.http.get<Question>(`${this.apiUrl}/${questionUid}`);
  }

  createQuestion(data: any): Observable<Question> {
    return this.http.post<Question>(this.apiUrl, data);
  }

  updateQuestion(questionUid: string, data: any): Observable<Question> {
    return this.http.put<Question>(`${this.apiUrl}/${questionUid}`, data);
  }

  deleteQuestion(questionUid: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${questionUid}`);
  }

  updateStatus(questionUid: string, isActive: boolean, updatedBy: string) {
    return this.http.patch(`${this.apiUrl}/${questionUid}/status`, {
      is_active: isActive,
      updated_by: updatedBy
    });
  }

  updateOrder(questionUid: string, displayOrder: number, updatedBy: string) {
    return this.http.patch(`${this.apiUrl}/${questionUid}/order`, {
      display_order: displayOrder,
      updated_by: updatedBy
    });
  }

}