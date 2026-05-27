from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_users():
    return []


@router.post("", status_code=201)
async def create_user():
    return {"id": "u1"}


@router.get("/{user_id}")
async def get_user(user_id: str):
    return {"id": user_id}


@router.patch("/{user_id}")
async def update_user(user_id: str):
    return {"id": user_id}


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: str):
    return None
