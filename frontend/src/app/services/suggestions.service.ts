// suggestions.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';

// Doit rester synchronisé avec ALLOWED_SUGGESTION_QUESTION_REFS côté backend
export const AI_SUGGESTION_QUESTION_REFS = new Set([
  'ADM-001', 'ADM-007', 'ADM-009', 'ADM-011', 'ADM-015',
  'ADM-017', 'ADM-022', 'ADM-025', 'ADM-037', 'ADM-038',
  'ADM-040', 'ENV-004', 'ENV-009', 'ENV-011', 'ENV-012',
]);

interface SuggestionResponse {
  question_ref: string;
  suggestions: string[];
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

@Injectable({ providedIn: 'root' })
export class SuggestionsService {
  private baseUrl = 'http://localhost:8000/api/adm-assessment/sessions';
  constructor(private http: HttpClient) {}

  isEnabledFor(questionRef: string): boolean {
    return AI_SUGGESTION_QUESTION_REFS.has(questionRef);
  }

  private fetch(sessionUid: string, questionRef: string, partialAnswer: string): Observable<string[]> {
    if (!this.isEnabledFor(questionRef) || partialAnswer.trim().length < MIN_CHARS) {
      return of([]);
    }
    return this.http
      .post<SuggestionResponse>(
         `${this.baseUrl}/${sessionUid}/questions/${questionRef}/suggestions`,
        { partial_answer: partialAnswer }
      )
      .pipe(
        switchMap((res) => of(res.suggestions ?? [])),
        catchError(() => of([]))
      );
  }

  /**
   * Crée un flux réactif : pousser un texte dans l'input$ retourné
   * déclenche automatiquement l'appel (avec debounce + annulation
   * de la requête précédente via switchMap).
   */
  createSuggestionStream(sessionUid: string, questionRef: string): {
    input$: Subject<string>;
    results$: Observable<string[]>;
  } {
    const input$ = new Subject<string>();
    const results$ = input$.pipe(
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((term) => this.fetch(sessionUid, questionRef, term))
    );
    return { input$, results$ };
  }
}