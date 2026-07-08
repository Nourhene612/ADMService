from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.database import Base, engine
from app.routes import admin , answer , customer , question , sessions 
# Import tes routes ici (exemple)
# from app.routes import users

app = FastAPI(
    title="Vision ADM Assessment API",
    version="1.0.0"
)

# ----------------------
# CORS (Angular / frontend)
# ----------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------
# Routes test
# ----------------------
@app.get("/")
def read_root():
    return {"message": "Backend is running 🚀"}

# ----------------------
# Include routers 
# ----------------------
app.include_router(admin.router, prefix="/api/adm-assessment")
app.include_router(answer.router, prefix="/api/adm-assessment")
app.include_router(customer.router, prefix="/api/adm-assessment")
app.include_router(question.router, prefix="/api/adm-assessment")
app.include_router(sessions.router, prefix="/api/adm-assessment")