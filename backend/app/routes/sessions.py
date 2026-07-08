from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services import session_service
from app.schemas.session import (
    AdmAssessmentSessionCreate,
    AdmAssessmentSessionSaveDraft,
    AdmAssessmentSessionSubmit,
    AdmAssessmentSessionCancel,
    AdmAssessmentSessionRead,
    AdmAssessmentSessionProgress,
)

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("/start", response_model=AdmAssessmentSessionRead, status_code=status.HTTP_201_CREATED)
def start_session(payload: AdmAssessmentSessionCreate, db: Session = Depends(get_db)):
    return session_service.start_session(
        db,
        customer_uid=payload.customer_uid,
        company_uid=payload.company_uid,
        assessment_type=payload.assessment_type,
        metadata_json=payload.metadata_json,
    )


@router.get("/{session_uid}", response_model=AdmAssessmentSessionRead)
def get_session(session_uid: str, db: Session = Depends(get_db)):
    return session_service.get_session(db, session_uid)


@router.get("/{session_uid}/progress", response_model=AdmAssessmentSessionProgress)
def get_session_progress(session_uid: str, db: Session = Depends(get_db)):
    return session_service.get_session_progress(db, session_uid)


@router.post("/{session_uid}/save-draft", response_model=AdmAssessmentSessionRead)
def save_draft(session_uid: str, payload: AdmAssessmentSessionSaveDraft, db: Session = Depends(get_db)):
    return session_service.save_draft(
        db,
        session_uid=session_uid,
        current_step=payload.current_step,
        completed_steps_json=payload.completed_steps_json,
        metadata_json=payload.metadata_json,
    )


@router.post("/{session_uid}/submit", response_model=AdmAssessmentSessionRead)
def submit_session(session_uid: str, payload: AdmAssessmentSessionSubmit, db: Session = Depends(get_db)):
    return session_service.submit_session(db, session_uid, payload.submitted_by)


@router.post("/{session_uid}/cancel", response_model=AdmAssessmentSessionRead)
def cancel_session(session_uid: str, payload: AdmAssessmentSessionCancel, db: Session = Depends(get_db)):
    return session_service.cancel_session(
        db,
        session_uid=session_uid,
        reason=payload.reason,
        cancelled_by=payload.cancelled_by,
    )