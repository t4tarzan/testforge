from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_items():
    return []


@router.post("", status_code=201)
async def create_item():
    return {"id": "i1"}


@router.get("/{item_id}")
async def get_item(item_id: str):
    return {"id": item_id}
