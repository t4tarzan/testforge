from fastapi import FastAPI
from app.api.v1 import users, items

app = FastAPI(title="polyglot fixture")

app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(items.router, prefix="/api/v1/items", tags=["items"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/metrics")
async def metrics():
    return {"requests": 0}
