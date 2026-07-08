from sqlalchemy.orm import Session as DBSession
from app.models.adm_assessment_question import AdmAssessmentQuestion


def get(db: DBSession, question_uid: str) -> AdmAssessmentQuestion | None:
    return db.query(AdmAssessmentQuestion).filter_by(uid=question_uid).first()


def get_by_ref(db: DBSession, question_ref: str) -> AdmAssessmentQuestion | None:
    return db.query(AdmAssessmentQuestion).filter_by(question_ref=question_ref).first()


def get_all(db: DBSession, active_only: bool = False) -> list[AdmAssessmentQuestion]:
    query = db.query(AdmAssessmentQuestion)
    if active_only:
        query = query.filter_by(is_active=True)

    return (
        query.order_by(AdmAssessmentQuestion.section_key, AdmAssessmentQuestion.display_order)
        .all()
    )


def get_active(db: DBSession) -> list[AdmAssessmentQuestion]:
    return get_all(db, active_only=True)


def create(db: DBSession, data: dict) -> AdmAssessmentQuestion:
    question = AdmAssessmentQuestion(**data)
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def update(db: DBSession, question: AdmAssessmentQuestion, data: dict) -> AdmAssessmentQuestion:
    for key, value in data.items():
        setattr(question, key, value)
    db.commit()
    db.refresh(question)
    return question


def delete(db: DBSession, question: AdmAssessmentQuestion) -> None:
    db.delete(question)
    db.commit() 

def get_active_ordered(db: DBSession) -> list[AdmAssessmentQuestion]:
    return (
        db.query(AdmAssessmentQuestion)
        .filter_by(is_active=True)
        .order_by(AdmAssessmentQuestion.section_key, AdmAssessmentQuestion.display_order)
        .all()
    )