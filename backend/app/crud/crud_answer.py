from sqlalchemy.orm import Session as DBSession
from app.models.adm_assessment_answer import AdmAssessmentAnswer


def get(db: DBSession, answer_uid: str) -> AdmAssessmentAnswer | None:
    return db.query(AdmAssessmentAnswer).filter_by(uid=answer_uid).first()


def get_by_session_and_question(
    db: DBSession, session_uid: str, question_uid: str
) -> AdmAssessmentAnswer | None:
    return (
        db.query(AdmAssessmentAnswer)
        .filter_by(session_uid=session_uid, question_uid=question_uid)
        .first()
    )


def get_all_by_session(db: DBSession, session_uid: str) -> list[AdmAssessmentAnswer]:
    return db.query(AdmAssessmentAnswer).filter_by(session_uid=session_uid).all()


def create(db: DBSession, data: dict) -> AdmAssessmentAnswer:
    answer = AdmAssessmentAnswer(**data)
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return answer


def update(db: DBSession, answer: AdmAssessmentAnswer, data: dict) -> AdmAssessmentAnswer:
    for key, value in data.items():
        setattr(answer, key, value)
    db.commit()
    db.refresh(answer)
    return answer


def delete(db: DBSession, answer: AdmAssessmentAnswer) -> None:
    db.delete(answer)
    db.commit()