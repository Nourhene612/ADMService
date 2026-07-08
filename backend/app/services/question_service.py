from sqlalchemy.orm import Session as DBSession
from fastapi import HTTPException, status

from app.models.adm_assessment_question import AdmAssessmentQuestion
from app.crud import crud_question


def get_or_404(db: DBSession, question_uid: str) -> AdmAssessmentQuestion:
    question = crud_question.get(db, question_uid)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question introuvable.")
    return question


# ======================================================
# PATCH /admin/questions/{uid}/status
# Règle métier : incrémente la version à chaque changement de statut
# (pour tracer l'historique des activations/désactivations)
# ======================================================
def update_status(db: DBSession, question_uid: str, is_active: bool, updated_by: str | None) -> AdmAssessmentQuestion:
    question = get_or_404(db, question_uid)

    if question.is_active == is_active:
        # Rien à faire, évite d'incrémenter la version inutilement
        return question

    question.is_active = is_active
    question.updated_by = updated_by
    question.version += 1

    db.commit()
    db.refresh(question)
    return question


# ======================================================
# PATCH /admin/questions/{uid}/order
# Règle métier : réorganise aussi les autres questions de la même section/sous-section
# pour éviter les doublons de display_order
# ======================================================
def update_order(
    db: DBSession,
    question_uid: str,
    new_order: int,
    updated_by: str | None,
) -> AdmAssessmentQuestion:
    question = get_or_404(db, question_uid)
    old_order = question.display_order

    if old_order == new_order:
        return question

    siblings = (
        db.query(AdmAssessmentQuestion)
        .filter(
            AdmAssessmentQuestion.section_key == question.section_key,
            AdmAssessmentQuestion.subsection_key == question.subsection_key,
            AdmAssessmentQuestion.uid != question.uid,
        )
        .all()
    )

    if new_order > old_order:
        # La question descend → décale vers le haut celles entre l'ancienne et la nouvelle position
        for sibling in siblings:
            if old_order < sibling.display_order <= new_order:
                sibling.display_order -= 1
    else:
        # La question remonte → décale vers le bas celles entre la nouvelle et l'ancienne position
        for sibling in siblings:
            if new_order <= sibling.display_order < old_order:
                sibling.display_order += 1

    question.display_order = new_order
    question.updated_by = updated_by

    db.commit()
    db.refresh(question)
    return question


# ======================================================
# GET /admin/questions/grouped-by-section
# ======================================================
def get_grouped_by_section(db: DBSession, active_only: bool = False) -> dict:
    questions = crud_question.get_all(db, active_only=active_only)

    result: dict[str, dict[str, list[AdmAssessmentQuestion]]] = {}

    for q in questions:
        section = result.setdefault(q.section_key, {})
        subsection = q.subsection_key or "default"
        section.setdefault(subsection, []).append(q)

    return result