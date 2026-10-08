from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings


class Base(DeclarativeBase):
    pass


kwargs = {"pool_pre_ping": True}
if not settings.web_database_url.startswith("sqlite"):
    kwargs.update({"pool_size": 5, "max_overflow": 10, "pool_timeout": 10, "pool_recycle": 1800})

engine = create_engine(settings.web_database_url, **kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
