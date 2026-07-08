from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session as DBSession
from fastapi import HTTPException, status

from app.models.adm_assessment_session import AdmAssessmentSession, SessionStatus
from app.models.adm_assessment_question import AdmAssessmentQuestion
from app.models.adm_assessment_answer import AdmAssessmentAnswer

# ----------------------------------------------------
# Transitions autorisées : depuis quel statut → vers quel statut
# ----------------------------------------------------
ALLOWED_TRANSITIONS = {
    SessionStatus.draft: {SessionStatus.submitted, SessionStatus.cancelled, SessionStatus.expired},
    SessionStatus.submitted: set(),   # état final
    SessionStatus.cancelled: set(),   # état final
    SessionStatus.expired: set(),     # état final
}

# Durée de validité par défaut d'une session brouillon (modifiable)
DEFAULT_SESSION_DURATION = timedelta(hours=48)


def get_session_or_404(db: DBSession, session_uid: str) -> AdmAssessmentSession:
    session = db.query(AdmAssessmentSession).filter_by(uid=session_uid).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session introuvable.")
    return session


def calculate_completed_steps(
    db: DBSession,
    session_uid: str,
) -> list[str]:
    """
    Calcule les étapes (sections/sous-sections) complétées
    basé sur les réponses données pour cette session.
    
    Une étape est complète si:
    - Toutes les questions REQUISES (is_required=True) de cette étape ont une réponse
    """
    # Récupère toutes les questions actives
    questions = (
        db.query(AdmAssessmentQuestion)
        .filter_by(is_active=True)
        .all()
    )
    
    # Récupère toutes les réponses pour cette session
    answered_question_uids = set(
        uid[0] for uid in db.query(AdmAssessmentAnswer.question_uid)
        .filter_by(session_uid=session_uid)
        .all()
    )
    
    # Groupe les questions par section/subsection
    steps: dict[str, list[AdmAssessmentQuestion]] = {}
    
    for q in questions:
        step_key = f"{q.section_key}/{q.subsection_key or 'default'}"
        if step_key not in steps:
            steps[step_key] = []
        steps[step_key].append(q)
    
    # Détermine quelles étapes sont complètes
    completed_steps = []
    
    for step_key, step_questions in steps.items():
        # Filtre les questions requises
        required_questions = [q for q in step_questions if q.is_required]
        
        # Si aucune question requise, l'étape est considérée comme complète
        if not required_questions:
            completed_steps.append(step_key)
            continue
        
        # Vérifie si toutes les questions requises ont une réponse
        all_answered = all(q.uid in answered_question_uids for q in required_questions)
        
        if all_answered:
            completed_steps.append(step_key)
    
    return sorted(completed_steps)


def ensure_transition_allowed(session: AdmAssessmentSession, target_status: SessionStatus):
    if target_status not in ALLOWED_TRANSITIONS[session.status]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Impossible de passer de '{session.status}' à '{target_status}'.",
        )


# ======================================================
# 1. ÉTAT "draft" — Comment une session devient un brouillon
# ======================================================
# Déclenché par : POST /sessions/start
# C'est le SEUL point d'entrée qui crée une session — elle démarre TOUJOURS en "draft"

def start_session(
    db: DBSession,
    customer_uid: str,
    company_uid: str | None,
    assessment_type: str,
    metadata_json: dict | None = None,
) -> AdmAssessmentSession:
    session = AdmAssessmentSession(
        customer_uid=customer_uid,
        company_uid=company_uid,
        assessment_type=assessment_type,
        status=SessionStatus.draft,          # ← statut initial, toujours "draft"
        current_step=None,
        progress_percentage=0,
        completed_steps_json=[],
        metadata_json=metadata_json,
        started_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + DEFAULT_SESSION_DURATION,  # ← définit la limite d'expiration
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# Reste en "draft" : chaque sauvegarde de progression NE change PAS le statut
# Déclenché par : POST /sessions/{uid}/save-draft
def save_draft(
    db: DBSession,
    session_uid: str,
    current_step: str | None,
    completed_steps_json,
    metadata_json,
) -> AdmAssessmentSession:
    session = get_session_or_404(db, session_uid)
    apply_expiration_if_needed(db, session)   # vérifie d'abord si elle n'a pas expiré entre-temps

    if session.status != SessionStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Impossible de modifier une session au statut '{session.status}'.",
        )

    if current_step is not None:
        session.current_step = current_step
    
    # Calcule automatiquement les étapes complétées basé sur les réponses en base
    session.completed_steps_json = calculate_completed_steps(db, session_uid)
    
    if metadata_json is not None:
        session.metadata_json = metadata_json
    # status reste "draft" — save-draft ne fait JAMAIS avancer le statut

    db.commit()
    db.refresh(session)
    return session


# ======================================================
# 2. ÉTAT "submitted" — Comment une session est finalisée
# ======================================================
# Déclenché par : POST /sessions/{uid}/submit
# Transition possible UNIQUEMENT depuis "draft"

def submit_session(db: DBSession, session_uid: str, submitted_by: str) -> AdmAssessmentSession:
    session = get_session_or_404(db, session_uid)
    apply_expiration_if_needed(db, session)      # une session expirée ne peut pas être soumise
    ensure_transition_allowed(session, SessionStatus.submitted)

    session.status = SessionStatus.submitted     # ← seul endroit du code qui met ce statut
    session.submitted_by = submitted_by
    session.submitted_at = datetime.now(timezone.utc)
    session.progress_percentage = 100

    db.commit()
    db.refresh(session)
    return session


# ======================================================
# 3. ÉTAT "cancelled" — Comment une session est annulée
# ======================================================
# Déclenché par : POST /sessions/{uid}/cancel
# Transition possible UNIQUEMENT depuis "draft"
# (on ne peut pas annuler une session déjà soumise, cf. ALLOWED_TRANSITIONS)

def cancel_session(
    db: DBSession,
    session_uid: str,
    reason: str | None,
    cancelled_by: str | None,
) -> AdmAssessmentSession:
    session = get_session_or_404(db, session_uid)
    apply_expiration_if_needed(db, session)
    ensure_transition_allowed(session, SessionStatus.cancelled)

    session.status = SessionStatus.cancelled     # ← seul endroit du code qui met ce statut

    meta = session.metadata_json or {}
    meta["cancel_reason"] = reason
    meta["cancelled_by"] = cancelled_by
    session.metadata_json = meta

    db.commit()
    db.refresh(session)
    return session


# ======================================================
# 4. ÉTAT "expired" — Comment une session expire
# ======================================================
# Ce n'est PAS déclenché par une route explicite — c'est une transition AUTOMATIQUE,
# recalculée à chaque fois qu'on accède à la session, si expires_at est dépassé.

def apply_expiration_if_needed(db: DBSession, session: AdmAssessmentSession) -> AdmAssessmentSession:
    """
    Vérifie et applique l'expiration immédiatement, AVEC commit,
    pour ne jamais perdre ce changement d'état même si l'appelant lève une exception après.
    """
    if (
        session.status == SessionStatus.draft
        and session.expires_at
    ):
        now = datetime.now(timezone.utc)
        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            # Si la date en base est naive, on la considère comme UTC.
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < now:
            session.status = SessionStatus.expired    
            db.commit()                                
            db.refresh(session)
    return session


# ======================================================
# LECTURE — utilisée par GET /sessions/{uid} et GET /sessions/{uid}/progress
# Garantit que le statut renvoyé au frontend est toujours à jour, même si
# l'expiration n'a pas encore été "détectée" par une action d'écriture.
# ======================================================
def get_session(db: DBSession, session_uid: str) -> AdmAssessmentSession:
    session = get_session_or_404(db, session_uid)
    apply_expiration_if_needed(db, session)
    return session 



# ======================================================
# GET /sessions/{uid}/progress
# ======================================================
def get_session_progress(db: DBSession, session_uid: str) -> dict:
    session = get_session(db, session_uid)  # applique déjà l'expiration

    total_questions = (
        db.query(AdmAssessmentQuestion)
        .filter_by(is_active=True)
        .count()
    )
    answered_questions = (
        db.query(AdmAssessmentAnswer)
        .filter_by(session_uid=session_uid)
        .count()
    )

    percentage = (
        int((answered_questions / total_questions) * 100) if total_questions else 0
    )

    # Calcule les étapes complétées basé sur les réponses actuelles
    completed_steps = calculate_completed_steps(db, session_uid)
    
    # Garde la session synchronisée si le pourcentage a changé depuis la dernière sauvegarde
    if session.status == SessionStatus.draft and session.progress_percentage != percentage:
        session.progress_percentage = percentage
        session.completed_steps_json = completed_steps
        db.commit()
        db.refresh(session)

    remaining_questions = max(total_questions - answered_questions, 0)

    return {
        "session_uid": session.uid,
        "status": session.status,
        "current_step": session.current_step,
        "progress_percentage": percentage,
        "completed_steps": completed_steps,
        "total_questions": total_questions,
        "answered_questions": answered_questions,
        "remaining_questions": remaining_questions,
    }