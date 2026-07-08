from datetime import datetime, timezone
from sqlalchemy.orm import Session as DBSession
from fastapi import HTTPException, status

from app.crud import crud_answer, crud_question
from app.models.adm_assessment_answer import AdmAssessmentAnswer
from app.models.adm_assessment_session import SessionStatus
from app.services.session_service import get_session_or_404, apply_expiration_if_needed
from app.services.validate_answer import validate_answer


def _ensure_session_editable(db: DBSession, session_uid: str):
    session = get_session_or_404(db, session_uid)
    apply_expiration_if_needed(db, session)
    if session.status != SessionStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Impossible de modifier les réponses d'une session au statut '{session.status}'.",
        )
    return session


def get_answer_or_404(db: DBSession, answer_uid: str):
    answer = crud_answer.get(db, answer_uid)
    if not answer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Réponse introuvable.")
    return answer


def _get_answer_for_session_or_404(db: DBSession, session_uid: str, answer_uid: str):
    """Récupère une réponse en garantissant qu'elle appartient bien à la session donnée.

    Évite qu'un answer_uid valide mais rattaché à une autre session soit accessible
    (isolation entre sessions).
    """
    answer = get_answer_or_404(db, answer_uid)
    if answer.session_uid != session_uid:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Réponse introuvable pour cette session.")
    return answer


def get_answer(db: DBSession, session_uid: str, answer_uid: str) -> object:
    """Utilisée par GET /sessions/{session_uid}/answers/{answer_uid}."""
    get_session_or_404(db, session_uid)  # 404 si session inexistante
    return _get_answer_for_session_or_404(db, session_uid, answer_uid)


def _load_session_answers_by_ref(db: DBSession, session_uid: str) -> dict[str, AdmAssessmentAnswer]:
    answers = crud_answer.get_all_by_session(db, session_uid)
    result: dict[str, AdmAssessmentAnswer] = {}
    for answer in answers:
        question_ref = None
        if answer.question is not None:
            question_ref = getattr(answer.question, "question_ref", None)
        if question_ref:
            result[question_ref] = answer
    return result


def list_answers(db: DBSession, session_uid: str) -> list:
    get_session_or_404(db, session_uid)  # 404 si session inexistante
    return crud_answer.get_all_by_session(db, session_uid)


def create_answer(db: DBSession, session_uid: str, payload) -> object:
    _ensure_session_editable(db, session_uid)

    question = crud_question.get(db, payload.question_uid)
    if not question:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question introuvable.")

    if not question.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La question est inactive et ne peut pas être répondue.")

    existing = crud_answer.get_by_session_and_question(db, session_uid, payload.question_uid)
    if existing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Une réponse existe déjà pour cette question dans cette session. Utilise PUT pour la modifier.",
        )

    if payload.question_ref is not None and payload.question_ref != question.question_ref:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "La question_uid ne correspond pas à la question_ref fournie.",
        )

    answers_by_ref = _load_session_answers_by_ref(db, session_uid)
    is_valid, error = validate_answer(question, payload, answers_by_ref)

    data = payload.model_dump(exclude={"question_ref"})
    data["session_uid"] = session_uid
    data["is_valid"] = is_valid
    data["validation_error"] = error
    data["answered_at"] = datetime.now(timezone.utc)

    return crud_answer.create(db, data)


def update_answer(db: DBSession, session_uid: str, answer_uid: str, payload) -> object:
    _ensure_session_editable(db, session_uid)

    answer = _get_answer_for_session_or_404(db, session_uid, answer_uid)

    question = crud_question.get(db, payload.question_uid)
    if not question:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question introuvable.")

    if not question.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La question est inactive et ne peut pas être modifiée.")

    if payload.question_ref is not None and payload.question_ref != question.question_ref:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "La question_uid ne correspond pas à la question_ref fournie.",
        )

    answers_by_ref = _load_session_answers_by_ref(db, session_uid)
    is_valid, error = validate_answer(question, payload, answers_by_ref)

    data = payload.model_dump(exclude={"question_ref"})
    data["is_valid"] = is_valid
    data["validation_error"] = error
    data["answered_at"] = datetime.now(timezone.utc)

    return crud_answer.update(db, answer, data)


def delete_answer(db: DBSession, session_uid: str, answer_uid: str) -> None:
    _ensure_session_editable(db, session_uid)

    answer = _get_answer_for_session_or_404(db, session_uid, answer_uid)

    crud_answer.delete(db, answer)


def bulk_upsert_answers(db: DBSession, session_uid: str, items: list) -> dict:
    _ensure_session_editable(db, session_uid)

    created = []
    updated = []
    errors = []

    answers_by_ref = _load_session_answers_by_ref(db, session_uid)

    for item in items:
        try:
            question = crud_question.get(db, item.question_uid)
            if not question:
                errors.append({
                    "question_uid": item.question_uid,
                    "error": "Question introuvable.",
                })
                continue

            if not question.is_active:
                errors.append({
                    "question_uid": item.question_uid,
                    "error": "La question est inactive et ne peut pas être modifiée.",
                })
                continue

            if item.question_ref is not None and item.question_ref != question.question_ref:
                errors.append({
                    "question_uid": item.question_uid,
                    "error": "La question_uid ne correspond pas à la question_ref fournie.",
                })
                continue

            is_valid, error = validate_answer(question, item, answers_by_ref)

            data = item.model_dump(exclude={"answer_uid", "question_ref"})
            data["session_uid"] = session_uid
            data["is_valid"] = is_valid
            data["validation_error"] = error
            data["answered_at"] = datetime.now(timezone.utc)

            # Détermine create vs update : par answer_uid explicite, sinon par (session_uid, question_uid)
            existing = None
            if item.answer_uid:
                existing = crud_answer.get(db, item.answer_uid)
                if existing and existing.session_uid != session_uid:
                    errors.append({
                        "question_uid": item.question_uid,
                        "error": "answer_uid ne correspond pas à cette session.",
                    })
                    continue
            else:
                existing = crud_answer.get_by_session_and_question(db, session_uid, item.question_uid)

            if existing:
                answer = crud_answer.update(db, existing, data)
                updated.append(answer)
            else:
                answer = crud_answer.create(db, data)
                created.append(answer)

            # IMPORTANT : on rafraîchit le cache des réponses par ref immédiatement après
            # chaque upsert, pour que les dépendances entre questions du même batch
            # (ex: item n°3 dépend de la réponse à l'item n°1 soumis juste avant) soient
            # visibles pour la validation des items suivants de la boucle.
            if question.question_ref:
                answers_by_ref[question.question_ref] = answer

        except Exception as e:
            errors.append({"question_uid": item.question_uid, "error": str(e)})

    return {"created": created, "updated": updated, "errors": errors}