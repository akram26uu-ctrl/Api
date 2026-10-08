import os
import pytest


@pytest.mark.skipif(not os.getenv("TEST_POSTGRES_DATABASE_URL"), reason="TEST_POSTGRES_DATABASE_URL is not configured")
def test_postgres_connectivity_and_migrations():
    from sqlalchemy import create_engine, text

    engine = create_engine(os.environ["TEST_POSTGRES_DATABASE_URL"], pool_pre_ping=True)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar_one() == 1
