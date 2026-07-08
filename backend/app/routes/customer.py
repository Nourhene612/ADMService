from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services import customer_service
from app.schemas.customer import CustomerSessionsResponse

router = APIRouter(prefix="/customers", tags=["Customer History"])


@router.get("/{customer_uid}/sessions", response_model=CustomerSessionsResponse)
def get_customer_sessions(customer_uid: str, db: Session = Depends(get_db)):
    sessions = customer_service.get_all_sessions(db, customer_uid)
    return CustomerSessionsResponse(
        customer_uid=customer_uid,
        total=len(sessions),
        sessions=sessions,
    )


@router.get("/{customer_uid}/drafts", response_model=CustomerSessionsResponse)
def get_customer_drafts(customer_uid: str, db: Session = Depends(get_db)):
    sessions = customer_service.get_draft_sessions(db, customer_uid)
    return CustomerSessionsResponse(
        customer_uid=customer_uid,
        total=len(sessions),
        sessions=sessions,
    )


@router.get("/{customer_uid}/submitted", response_model=CustomerSessionsResponse)
def get_customer_submitted(customer_uid: str, db: Session = Depends(get_db)):
    sessions = customer_service.get_submitted_sessions(db, customer_uid)
    return CustomerSessionsResponse(
        customer_uid=customer_uid,
        total=len(sessions),
        sessions=sessions,
    )