from sqlalchemy.orm import Session as DBSession

from app.models.adm_assessment_session import AdmAssessmentSession, SessionStatus
from app.services.session_service import apply_expiration_if_needed


def _get_sessions(
    db: DBSession,
    customer_uid: str,
    status_filter: SessionStatus | None = None,
) -> list[AdmAssessmentSession]:
    query = db.query(AdmAssessmentSession).filter_by(customer_uid=customer_uid)

    if status_filter is not None:
        query = query.filter_by(status=status_filter)

    sessions = query.order_by(AdmAssessmentSession.started_at.desc()).all()

    # Recalcule l'expiration à la volée avant de renvoyer la liste
    for session in sessions:
        apply_expiration_if_needed(db, session)

    return sessions


# GET /customers/{customer_uid}/sessions
def get_all_sessions(db: DBSession, customer_uid: str) -> list[AdmAssessmentSession]:
    return _get_sessions(db, customer_uid)


# GET /customers/{customer_uid}/drafts
def get_draft_sessions(db: DBSession, customer_uid: str) -> list[AdmAssessmentSession]:
    return _get_sessions(db, customer_uid, status_filter=SessionStatus.draft)


# GET /customers/{customer_uid}/submitted
def get_submitted_sessions(db: DBSession, customer_uid: str) -> list[AdmAssessmentSession]:
    return _get_sessions(db, customer_uid, status_filter=SessionStatus.submitted)