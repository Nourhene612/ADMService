from __future__ import annotations

from typing import TYPE_CHECKING
from sqlalchemy.orm import Session as DBSession

from app.models.adm_assessment_question import AdmAssessmentQuestion
from app.models.adm_assessment_answer import AdmAssessmentAnswer

# Import des types de schéma uniquement pour le typage statique afin
# d'éviter les importations au runtime qui peuvent provoquer des
# import errors/circular imports lors du démarrage de l'app.
if TYPE_CHECKING:
    from app.schemas.question import (
        ConditionOperator,
        ConditionRule,
        ConditionGroup,
        LogicalOperator,
        DependencyConfig,
        DependencyAction,
    )


def evaluate_condition_rule(
    rule: ConditionRule, answers_by_question_ref: dict
) -> bool:
    """
    Évalue une règle de condition simple.
    
    Args:
        rule: Règle à évaluer (question_ref, operator, value)
        answers_by_question_ref: Dict {question_ref: answer_value}
    
    Returns:
        True si la condition est satisfaite, False sinon
    """
    question_ref = rule.question_ref
    operator = rule.operator
    value = rule.value

    # Récupère la réponse de la question référencée
    answer = answers_by_question_ref.get(question_ref)

    # Opérateurs qui n'ont pas besoin de valeur
    if operator == ConditionOperator.IS_EMPTY:
        return answer is None or answer == "" or answer == []

    if operator == ConditionOperator.IS_NOT_EMPTY:
        return answer is not None and answer != "" and answer != []

    # Pour les autres opérateurs, on a besoin d'une réponse
    if answer is None:
        return False

    # Opérateurs de comparaison
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
            # value doit être une liste
            if isinstance(value, list):
                return answer in value
            return answer == value

        if operator == ConditionOperator.NOT_IN:
            if isinstance(value, list):
                return answer not in value
            return answer != value

        if operator == ConditionOperator.CONTAINS:
            return str(value) in str(answer)

    except (ValueError, TypeError):
        # Si conversion échoue, retourne False
        return False

    return False


def evaluate_condition_group(
    group: ConditionGroup, answers_by_question_ref: dict
) -> bool:
    """
    Évalue récursivement un groupe de conditions avec logique AND/OR.
    
    Args:
        group: Groupe de conditions (rules + nested groups + logic)
        answers_by_question_ref: Dict {question_ref: answer_value}
    
    Returns:
        True si le groupe est satisfait, False sinon
    """
    # Évalue les rules du groupe courant
    rule_results = [
        evaluate_condition_rule(rule, answers_by_question_ref) for rule in group.rules
    ]

    # Évalue les sous-groupes récursivement
    group_results = [
        evaluate_condition_group(sub_group, answers_by_question_ref)
        for sub_group in group.groups
    ]

    all_results = rule_results + group_results

    # Pas de conditions = toujours vraix
    if not all_results:
        return True

    # Applique la logique AND ou OR
    if group.logic == LogicalOperator.AND:
        return all(all_results)
    else:  # LogicalOperator.OR
        return any(all_results)


def evaluate_visibility(
    question: AdmAssessmentQuestion, answers_by_question_ref: dict
) -> bool:
    """
    Évalue si une question doit être visible pour l'utilisateur
    basé sur ses conditions de visibilité et les réponses existantes.
    
    Args:
        question: La question à évaluer
        answers_by_question_ref: Dict {question_ref: answer_value} des réponses de l'utilisateur
    
    Returns:
        True si la question est visible, False sinon
    """
    # Si pas de condition de visibilité, la question est visible
    if not question.visibility_condition_json:
        return True

    # Évalue la condition de visibilité
    return evaluate_condition_group(
        question.visibility_condition_json, answers_by_question_ref
    )


def evaluate_dependency(
    dependency: DependencyConfig, answers_by_question_ref: dict
) -> tuple[bool, str]:
    """
    Évalue les dépendances d'une question et retourne l'action à appliquer.
    
    Args:
        dependency: Configuration de dépendance (condition + action)
        answers_by_question_ref: Dict {question_ref: answer_value} des réponses de l'utilisateur
    
    Returns:
        Tuple (condition_met: bool, action: str)
        - condition_met: True si la condition est satisfaite
        - action: L'action à appliquer (SHOW, HIDE, REQUIRE, DISABLE)
    """
    condition_met = evaluate_condition_group(
        dependency.condition, answers_by_question_ref
    )
    return condition_met, dependency.action


def evaluate_question_dependencies(
    question: AdmAssessmentQuestion, answers_by_question_ref: dict
) -> dict[str, any]:
    """
    Évalue l'état d'une question basé sur ses dépendances.
    
    Args:
        question: La question à évaluer
        answers_by_question_ref: Dict {question_ref: answer_value} des réponses de l'utilisateur
    
    Returns:
        Dict avec les statuts:
        {
            "is_visible": bool,           # Visibilité basée sur visibility_condition_json
            "is_enabled": bool,           # Activée ou désactivée par dépendance
            "is_required_by_dependency": bool  # Requise par une dépendance
        }
    """
    # Évalue la visibilité
    is_visible = evaluate_visibility(question, answers_by_question_ref)
    
    # Évalue les dépendances (une question peut avoir plusieurs dépendances)
    is_enabled = True
    is_required_by_dependency = False
    
    if question.dependency_json:
        # Si dependency_json est une liste de DependencyConfig
        dependencies = question.dependency_json if isinstance(question.dependency_json, list) else [question.dependency_json]
        
        for dep in dependencies:
            if isinstance(dep, dict):
                # Convertir le dict en DependencyConfig si nécessaire
                dep = DependencyConfig(**dep)
            
            condition_met, action = evaluate_dependency(dep, answers_by_question_ref)
            
            if action == DependencyAction.HIDE and condition_met:
                is_visible = False
            elif action == DependencyAction.SHOW and not condition_met:
                is_visible = False
            elif action == DependencyAction.DISABLE and condition_met:
                is_enabled = False
            elif action == DependencyAction.REQUIRE and condition_met:
                is_required_by_dependency = True
    
    return {
        "is_visible": is_visible,
        "is_enabled": is_enabled,
        "is_required_by_dependency": is_required_by_dependency,
    }


def get_questions_for_session(
    db: DBSession, session_uid: str
) -> dict[str, dict[str, list[dict]]]:
    """
    Récupère les questions d'une session, filtrées par visibilité
    et groupées par section/subsection.
    
    Args:
        db: Session SQLAlchemy
        session_uid: UID de la session de l'utilisateur
    
    Returns:
        Dict organisé par section → subsection → list[questions visibles avec réponses]
        Structure:
        {
            "section_key": {
                "subsection_key": [
                    {
                        "uid": "...",
                        "question_ref": "Q1",
                        "question_text": "...",
                        "answer_type": "text",
                        "current_answer": {...} ou None,
                        "is_visible": True,
                        ...
                    }
                ]
            }
        }
    """
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

            answers_by_question_uid[question.uid] = answer

    # Groupe les questions et filtre par visibilité
    result: dict[str, dict[str, list[dict]]] = {}

    for question in questions:
        # Évalue la visibilité ET les dépendances
        dependency_state = evaluate_question_dependencies(question, answers_by_question_ref)
        is_visible = dependency_state["is_visible"]

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
            # Données de dépendance
            "is_visible": is_visible,
            "is_enabled": dependency_state["is_enabled"],
            "is_required_by_dependency": dependency_state["is_required_by_dependency"],
        }

        result[question.section_key][subsection_key].append(question_data)

    return result


def get_visible_questions_for_session(
    db: DBSession, session_uid: str
) -> list[dict]:
    """
    Récupère uniquement les questions VISIBLES pour une session.
    Version aplanie (liste simple, sans groupement par section).
    
    Applique la logique de visibilité ET les dépendances (SHOW, HIDE, REQUIRE, DISABLE).
    
    Args:
        db: Session SQLAlchemy
        session_uid: UID de la session
    
    Returns:
        Liste des questions visibles avec leurs informations de dépendance:
        [
            {
                "uid": "...",
                "question_ref": "Q1",
                "is_visible": true,
                "is_enabled": true,
                "is_required_by_dependency": false,
                "current_answer": {...},
                ...
            }
        ]
    """
    grouped = get_questions_for_session(db, session_uid)
    visible_questions = []

    for section_key, subsections in grouped.items():
        for subsection_key, questions in subsections.items():
            for question in questions:
                if question["is_visible"]:
                    visible_questions.append(question)

    return visible_questions
