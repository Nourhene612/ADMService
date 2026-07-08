import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

# Charge les variables d'environnement depuis .env
load_dotenv()

# ----------------------
# Configuration de la connexion MySQL
# ----------------------
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    raise ValueError(
        "DATABASE_URL n'est pas définie. "
        "Vérifie ton fichier .env ou la config Docker Compose."
    )

# ----------------------
# Engine SQLAlchemy
# ----------------------
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,   # évite les erreurs de connexion "MySQL server has gone away"
    pool_recycle=3600,    # recycle les connexions après 1h (évite timeout MySQL)
    echo=False,           # mets à True pour voir les requêtes SQL générées (debug)
)

# ----------------------
# Session locale
# ----------------------
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ----------------------
# Base déclarative pour les modèles (syntaxe SQLAlchemy 2.0)
# ----------------------
class Base(DeclarativeBase):
    pass

# ----------------------
# Dependency FastAPI pour obtenir une session DB
# ----------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()