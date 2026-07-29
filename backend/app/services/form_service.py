from __future__ import annotations

from typing import TYPE_CHECKING
from sqlalchemy.orm import Session as DBSession

from app.models.adm_assessment_question import AdmAssessmentQuestion
from app.models.adm_assessment_answer import AdmAssessmentAnswer

# Import des types de schéma uniquement pour le typage statique afin
# d'éviter les importations au runtime qui peuvent provoquer des
# import errors/circular imports lors du démarrage de l'app.
if TYPE_CHECKING:
    from app.schemas.question import ConditionOperator, SimpleCondition


def evaluate_condition(
    condition: "SimpleCondition", answers_by_question_ref: dict
) -> bool:
    """
    Évalue une condition simple et unique: {question_ref, operator, value}.

    Args:
        condition: Condition à évaluer (question_ref, operator, value)
        answers_by_question_ref: Dict {question_ref: answer_value}

    Returns:
        True si la condition est satisfaite, False sinon
    """
    from app.schemas.question import ConditionOperator

    question_ref = condition.question_ref
    operator = condition.operator
    value = condition.value

    # Récupère la réponse de la question référencée
    answer = answers_by_question_ref.get(question_ref)

    # Opérateurs qui n'ont pas besoin de valeur ni de réponse existante
    if operator == ConditionOperator.IS_EMPTY:
        return answer is None or answer == "" or answer == []

    if operator == ConditionOperator.IS_NOT_EMPTY:
        return answer is not None and answer != "" and answer != []

    # Pour les autres opérateurs, on a besoin d'une réponse
    if answer is None:
        return False

    try:
        if operator == ConditionOperator.EQUALS:
            return answer == value

        if operator == ConditionOperator.NOT_EQUALS:
            return answer != value

        if operator == ConditionOperator.GREATER_THAN:
            return float(answer) > float(value)

        if operator == ConditionOperator.LESS_THAN:
            return float(answer) < float(value)

        if operator == ConditionOperator.GREATER_OR_EQUAL:
            return float(answer) >= float(value)

        if operator == ConditionOperator.LESS_OR_EQUAL:
            return float(answer) <= float(value)

        if operator == ConditionOperator.IN:
            if isinstance(value, list):
                return answer in value
            return answer == value

        if operator == ConditionOperator.NOT_IN:
            if isinstance(value, list):
                return answer not in value
            return answer != value

        if operator == ConditionOperator.INCLUDES:
            # answer est une liste (multi_select) qui doit contenir value
            if isinstance(answer, list):
                return value in answer
            return str(value) in str(answer)

        if operator == ConditionOperator.NOT_INCLUDES:
            if isinstance(answer, list):
                return value not in answer
            return str(value) not in str(answer)

    except (ValueError, TypeError):
        # Si la conversion échoue, on considère la condition non satisfaite
        return False

    return False


def evaluate_visibility(
    question: AdmAssessmentQuestion, answers_by_question_ref: dict
) -> bool:
    
    from app.schemas.question import SimpleCondition

    for raw_condition in (question.visibility_condition_json, question.dependency_json):
        if not raw_condition:
            continue

        condition = (
            SimpleCondition(**raw_condition)
            if isinstance(raw_condition, dict)
            else raw_condition
        )

        if not evaluate_condition(condition, answers_by_question_ref):
            return False

    return True


def get_questions_for_session(
    db: DBSession, session_uid: str
) -> dict[str, dict[str, list[dict]]]:
    
    # Récupère toutes les questions actives
    questions = (
        db.query(AdmAssessmentQuestion).filter_by(is_active=True).order_by(
            AdmAssessmentQuestion.section_key,
            AdmAssessmentQuestion.subsection_key,
            AdmAssessmentQuestion.display_order,
        )
    ).all()

    # Récupère toutes les réponses de la session
    answers = (
        db.query(AdmAssessmentAnswer).filter_by(session_uid=session_uid).all()
    )

    # Construit un dict des réponses par question_ref pour évaluation des conditions
    answers_by_question_ref = {}
    answers_by_question_uid = {}

    for answer in answers:
        question = answer.question
        if question:
            # Utilise la réponse "la plus récente" (ou la dernière) pour chaque question
            if answer.response_string:
                answers_by_question_ref[question.question_ref] = answer.response_string
            elif answer.response_number is not None:
                answers_by_question_ref[question.question_ref] = answer.response_number
            elif answer.response_boolean is not None:
                answers_by_question_ref[question.question_ref] = answer.response_boolean
            elif answer.response_list_json is not None:
                answers_by_question_ref[question.question_ref] = answer.response_list_json

            answers_by_question_uid[question.uid] = answer

    # Groupe les questions et filtre par visibilité
    result: dict[str, dict[str, list[dict]]] = {}

    for question in questions:
        is_visible = evaluate_visibility(question, answers_by_question_ref)

        # Crée l'entrée de section si elle n'existe pas
        if question.section_key not in result:
            result[question.section_key] = {}

        # Crée l'entrée de subsection si elle n'existe pas
        subsection_key = question.subsection_key or "default"
        if subsection_key not in result[question.section_key]:
            result[question.section_key][subsection_key] = []

        # Prépare les données de la question
        current_answer = None
        if question.uid in answers_by_question_uid:
            answer = answers_by_question_uid[question.uid]
            current_answer = {
                "uid": answer.uid,
                "response_string": answer.response_string,
                "response_number": answer.response_number,
                "response_boolean": answer.response_boolean,
                "response_list_json": answer.response_list_json,
                "response_object_json": answer.response_object_json,
                "is_valid": answer.is_valid,
                "answered_at": answer.answered_at,
            }

        question_data = {
            "uid": question.uid,
            "question_ref": question.question_ref,
            "question_text": question.question_text,
            "question_description": question.question_description,
            "section_key": question.section_key,
            "subsection_key": question.subsection_key,
            "display_order": question.display_order,
            "answer_type": question.answer_type,
            "answer_condition": question.answer_condition,
            "answer_options_json": question.answer_options_json,
            "answer_unit_json": question.answer_unit_json,
            "dependency_json": question.dependency_json,
            "input_placeholder": question.input_placeholder,
            "help_text": question.help_text,
            "validation_rules_json": question.validation_rules_json,
            "visibility_condition_json": question.visibility_condition_json,
            "default_value_json": question.default_value_json,
            "is_required": question.is_required,
            "score_weight": question.score_weight,
            "version": question.version,
            "created_at": question.created_at,
            "updated_at": question.updated_at,
            # Données de réponse
            "current_answer": current_answer,
            # Visibilité
            "is_visible": is_visible,
        }

        result[question.section_key][subsection_key].append(question_data)

    return result


def get_visible_questions_for_session(
    db: DBSession, session_uid: str
) -> list[dict]:
   
    grouped = get_questions_for_session(db, session_uid)
    visible_questions = []

    for section_key, subsections in grouped.items():
        for subsection_key, questions in subsections.items():
            for question in questions:
                if question["is_visible"]:
                    visible_questions.append(question)

    return visible_questions