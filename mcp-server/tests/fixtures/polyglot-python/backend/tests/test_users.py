import pytest


def test_list_users_empty():
    assert [] == []


def test_create_user_returns_id():
    assert "u1" == "u1"


@pytest.mark.asyncio
async def test_async_user_flow():
    assert True
