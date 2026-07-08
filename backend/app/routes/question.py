from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, Any

from app.models.database import get_db
from app.services import form_service
from app.services.session_service import get_session_or_404
from pydantic import BaseModel


router = APIRouter(prefix="/sessions", tags=["Questions"])


# ========================================================
# Response models pour GET /sessions/{session_uid}/questions
# ========================================================
class QuestionAnswerResponse(BaseModel):
    """Représentation simplifiée d'une réponse pour le contexte du formulaire"""
    uid: Optional[str] = None
    response_string: Optional[str] = None
    response_number: Optional[float] = None
    response_boolean: Optional[bool] = None
    response_list_json: Optional[Any] = None
    response_object_json: Optional[Any] = None
    is_valid: bool = True
    answered_at: Optional[datetime] = None


class QuestionDetailResponse(BaseModel):
    """Détail d'une question avec sa visibilité, ses dépendances et sa réponse actuelle"""
    uid: str
    question_ref: str
    question_text: str
    question_description: Optional[str] = None
    section_key: str
    subsection_key: Optional[str] = None
    display_order: int
    answer_type: str
    answer_condition: Optional[str] = None
    answer_options_json: Optional[Any] = None
    answer_unit_json: Optional[Any] = None
    dependency_json: Optional[Any] = None
    input_placeholder: Optional[str] = None
    help_text: Optional[str] = None
    validation_rules_json: Optional[Any] = None
    visibility_condition_json: Optional[Any] = None
    default_value_json: Optional[Any] = None
    is_required: bool
    score_weight: Optional[float] = 0
    version: int
    created_at: datetime
    updated_at: datetime
    # Données dynamiques
    current_answer: Optional[QuestionAnswerResponse] = None
    is_visible: bool = True
    is_enabled: bool = True
    is_required_by_dependency: bool = False

    class Config:
        from_attributes = True


class QuestionsForSessionResponse(BaseModel):
    """Réponse avec les questions visibles"""
    session_uid: str
    questions: list[QuestionDetailResponse]


# ========================================================
# GET /sessions/{session_uid}/questions
# Retourne uniquement les questions visibles pour l'utilisateur
# ========================================================
@router.get(
    "/{session_uid}/questions",
    response_model=QuestionsForSessionResponse,
)
def get_questions_for_session(
    session_uid: str,
    db: Session = Depends(get_db),
):
    """
    Récupère uniquement les questions VISIBLES d'une session
    selon les conditions de visibilité (visibility_condition_json)
    et les réponses actuelles de l'utilisateur.
    
    Args:
        session_uid: UID de la session
        db: Session de base de données
    
    Returns:
        {
            "session_uid": "...",
            "questions": [
                {
                    "uid": "...",
                    "question_ref": "Q1",
                    "question_text": "Votre nom ?",
                    "answer_type": "text",
                    "current_answer": {...} ou null,
                    "is_visible": true,
                    ...
                }
            ]
        }
    """
    # Vérifie que la session existe
    get_session_or_404(db, session_uid)

    # Récupère uniquement les questions visibles
    visible_questions = form_service.get_visible_questions_for_session(db, session_uid)

    # Formate la réponse
    return QuestionsForSessionResponse(
        session_uid=session_uid,
        questions=visible_questions,
    )
