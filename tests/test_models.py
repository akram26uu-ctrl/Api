from sqlalchemy.orm import configure_mappers

from app.db.base import Base
import app.models


def test_models():
    configure_mappers()

    tables = list(Base.metadata.tables.keys())

    print("Models loaded successfully.")
    print("Tables:")

    for table in tables:
        print(f"- {table}")


if __name__ == "__main__":
    test_models()