"""
suggestions.py

Route qui gère la complétion contextuelle du formulaire ADM :
- reçoit ce que l'utilisateur est en train de saisir (partial_answer)
- retrouve la question correspondante (texte + catégorie) pour la session
- appelle le modèle (Gemini) via prompt.get_suggestions()
- renvoie la liste de suggestions au frontend
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.database import get_db
from app.services import form_service
from app.services.session_service import get_session_or_404
from app.services import prompt_service  # module contenant get_suggestions()

router = APIRouter(prefix="/sessions", tags=["Suggestions"])

# ========================================================
# Liste blanche des questions pour lesquelles les suggestions
# IA sont autorisées. Toute autre question_ref sera rejetée.
# ========================================================
ALLOWED_SUGGESTION_QUESTION_REFS = {
    "ADM-001",  # Application-delivery tools
    "ADM-007",  # Requirements-management tools
    "ADM-009",  # Source-code platforms
    "ADM-011",  # Code-quality tools
    "ADM-015",  # Functional-testing tools
    "ADM-017",  # Test-management tools
    "ADM-022",  # Performance-testing tools
    "ADM-025",  # CI/CD platforms
    "ADM-037",  # Integrated systems
    "ADM-038",  # Integration methods
    "ADM-040",  # Reporting capabilities
    "ENV-004",  # Technologies and programming languages
    "ENV-009",  # Container platforms
    "ENV-011",  # Test-data tools
    "ENV-012",  # Deployment targets
}

# ========================================================
# Schémas
# ========================================================
class SuggestionRequest(BaseModel):
    """Ce que le frontend envoie : la saisie partielle de l'utilisateur."""
    partial_answer: str = Field(..., min_length=1, description="Texte déjà saisi par l'utilisateur")


class SuggestionResponse(BaseModel):
    """Ce qu'on renvoie au frontend."""
    question_ref: str
    suggestions: List[str]


# ========================================================
# Helper : retrouver la question (texte + catégorie) dans la session
# ========================================================
def _get_question_or_404(db: Session, session_uid: str, question_ref: str):
    """
    Réutilise la liste des questions visibles de la session pour retrouver
    la question ciblée par question_ref (texte, section_key, etc.).
    """
    questions = form_service.get_visible_questions_for_session(db, session_uid)
    question = next(
        (q for q in questions if q.get("question_ref") == question_ref),
        None,
    )
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question '{question_ref}' introuvable ou non visible pour cette session.",
        )
    return question


# ========================================================
# POST /sessions/{session_uid}/questions/{question_ref}/suggestions
# ========================================================
@router.post(
    "/{session_uid}/questions/{question_ref}/suggestions",
    response_model=SuggestionResponse,
)
def get_question_suggestions(
    session_uid: str,
    question_ref: str,
    payload: SuggestionRequest,
    db: Session = Depends(get_db),
):
    """
    Reçoit la saisie partielle de l'utilisateur pour une question donnée,
    interroge le modèle pour obtenir des suggestions de complétion,
    et les renvoie au frontend.

    Restreint aux 15 question_ref listées dans ALLOWED_SUGGESTION_QUESTION_REFS.

    Body attendu :
        { "partial_answer": "Jen" }

    Réponse :
        {
            "question_ref": "Q12",
            "suggestions": ["Jenkins", "Jenkins X"]
        }
    """
    # Vérifie d'abord que la question fait partie de la liste autorisée
    # (évite un appel modèle inutile / un accès non désiré aux autres questions)
    if question_ref not in ALLOWED_SUGGESTION_QUESTION_REFS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Les suggestions IA ne sont pas disponibles pour la question "
                f"'{question_ref}'."
            ),
        )

    # Vérifie que la session existe
    get_session_or_404(db, session_uid)

    # Retrouve la question (texte + catégorie) associée à question_ref
    question = _get_question_or_404(db, session_uid, question_ref)

    # Appelle le modèle pour obtenir les suggestions
    suggestions = prompt_service.get_suggestions(
        db=db,
        question=question["question_text"],
        partial_answer=payload.partial_answer,
        category=question["section_key"],
    )
    return SuggestionResponse(
        question_ref=question_ref,
        suggestions=suggestions,
    )