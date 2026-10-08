from app.db.database import test_database_connection as check_database_connection


def test_database_connection():
    assert check_database_connection() is True
