from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.crud import crud_question
from app.services import question_service
from app.schemas.question import (
    AdmAssessmentQuestionCreate,
    AdmAssessmentQuestionUpdate,
    AdmAssessmentQuestionStatusUpdate,
    AdmAssessmentQuestionOrderUpdate,
    AdmAssessmentQuestionRead,
)

router = APIRouter(prefix="/admin/questions", tags=["Admin Questions"])


# ----------------------
# CRUD pur — pas de règle métier
# ----------------------

@router.post("", response_model=AdmAssessmentQuestionRead, status_code=status.HTTP_201_CREATED)
def create_question(payload: AdmAssessmentQuestionCreate, db: Session = Depends(get_db)):
    if crud_question.get_by_ref(db, payload.question_ref):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ce question_ref existe déjà.")
    return crud_question.create(db, payload.model_dump())


@router.get("", response_model=list[AdmAssessmentQuestionRead])
def list_questions(db: Session = Depends(get_db)):
    return crud_question.get_all(db)



# interprète "grouped-by-section" comme une valeur de question_uid
@router.get("/grouped-by-section", response_model=dict[str, dict[str, list[AdmAssessmentQuestionRead]]])
def grouped_by_section(db: Session = Depends(get_db)):
    return question_service.get_grouped_by_section(db)


@router.get("/{question_uid}", response_model=AdmAssessmentQuestionRead)
def get_question(question_uid: str, db: Session = Depends(get_db)):
    question = crud_question.get(db, question_uid)
    if not question:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question introuvable.")
    return question


@router.put("/{question_uid}", response_model=AdmAssessmentQuestionRead)
def update_question(question_uid: str, payload: AdmAssessmentQuestionUpdate, db: Session = Depends(get_db)):
    question = crud_question.get(db, question_uid)
    if not question:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question introuvable.")
    return crud_question.update(db, question, payload.model_dump())


@router.delete("/{question_uid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_uid: str, db: Session = Depends(get_db)):
    question = crud_question.get(db, question_uid)
    if not question:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question introuvable.")
    crud_question.delete(db, question)


# ----------------------
# Routes avec logique métier — passent par question_service
# ----------------------

@router.patch("/{question_uid}/status", response_model=AdmAssessmentQuestionRead)
def update_question_status(
    question_uid: str,
    payload: AdmAssessmentQuestionStatusUpdate,
    db: Session = Depends(get_db),
):
    return question_service.update_status(db, question_uid, payload.is_active, payload.updated_by)


@router.patch("/{question_uid}/order", response_model=AdmAssessmentQuestionRead)
def update_question_order(
    question_uid: str,
    payload: AdmAssessmentQuestionOrderUpdate,
    db: Session = Depends(get_db),
):
    return question_service.update_order(db, question_uid, payload.display_order, payload.updated_by)