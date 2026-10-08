from fastapi import APIRouter
from app.api.internal.merchants import router as merchants_router

router = APIRouter(prefix="/internal/v1")
router.include_router(merchants_router)
