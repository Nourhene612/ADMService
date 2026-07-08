from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services import answer_service
from app.schemas.answer import (
    AdmAssessmentAnswerCreate,
    AdmAssessmentAnswerUpdate,
    AdmAssessmentAnswerRead,
    AdmAssessmentAnswerBulkUpsert,
    AdmAssessmentAnswerBulkUpsertResult,
)

router = APIRouter(prefix="/sessions", tags=["Answers"])


@router.get("/{session_uid}/answers", response_model=list[AdmAssessmentAnswerRead])
def list_answers(session_uid: str, db: Session = Depends(get_db)):
    return answer_service.list_answers(db, session_uid)


@router.get("/{session_uid}/answers/{answer_uid}", response_model=AdmAssessmentAnswerRead)
def get_answer(session_uid: str, answer_uid: str, db: Session = Depends(get_db)):
    return answer_service.get_answer(db, session_uid, answer_uid)


@router.post(
    "/{session_uid}/answers",
    response_model=AdmAssessmentAnswerRead,
    status_code=status.HTTP_201_CREATED,
)
def create_answer(session_uid: str, payload: AdmAssessmentAnswerCreate, db: Session = Depends(get_db)):
    return answer_service.create_answer(db, session_uid, payload)


@router.post(
    "/{session_uid}/answers/bulk-upsert",
    response_model=AdmAssessmentAnswerBulkUpsertResult,
)
def bulk_upsert_answers(
    session_uid: str,
    payload: AdmAssessmentAnswerBulkUpsert,
    db: Session = Depends(get_db),
):
    return answer_service.bulk_upsert_answers(db, session_uid, payload.answers)


@router.put("/{session_uid}/answers/{answer_uid}", response_model=AdmAssessmentAnswerRead)
def update_answer(
    session_uid: str,
    answer_uid: str,
    payload: AdmAssessmentAnswerUpdate,
    db: Session = Depends(get_db),
):
    return answer_service.update_answer(db, session_uid, answer_uid, payload)


@router.delete("/{session_uid}/answers/{answer_uid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_answer(session_uid: str, answer_uid: str, db: Session = Depends(get_db)):
    answer_service.delete_answer(db, session_uid, answer_uid)