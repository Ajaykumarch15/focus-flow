"""
MongoDB connection + ML data persistence via Motor (async driver).
Shares the same database as the Node.js backend.
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.getenv('MONGODB_URI', os.getenv('MONGO_URI', 'mongodb://localhost:27017'))
DB_NAME = os.getenv('DB_NAME', 'focusflow')

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


def get_db():
    return get_client()[DB_NAME]


# ── ML Data Persistence ──────────────────────────────────────────────────────

async def get_learning_examples(user_id: str) -> list[dict]:
    db = get_db()
    cursor = db.ml_examples.find({'userId': user_id}).sort('created_at', -1).limit(2000)
    return await cursor.to_list(length=2000)


async def upsert_learning_examples(user_id: str, examples: list[dict]) -> int:
    db = get_db()
    existing = {doc['id'] for doc in await db.ml_examples.find(
        {'userId': user_id}, {'id': 1}
    ).to_list(length=10000)}
    to_insert = [
        {**ex, 'userId': user_id}
        for ex in examples
        if ex.get('id') and ex['id'] not in existing
    ]
    if to_insert:
        await db.ml_examples.insert_many(to_insert)
    return len(to_insert)


async def get_feedback(user_id: str) -> list[dict]:
    db = get_db()
    cursor = db.ml_feedback.find({'userId': user_id}).sort('created_at', -1).limit(500)
    return await cursor.to_list(length=500)


async def add_feedback(user_id: str, item: dict) -> dict:
    db = get_db()
    item['userId'] = user_id
    result = await db.ml_feedback.insert_one(item)
    item['_id'] = str(result.inserted_id)
    return item


async def get_preferences(user_id: str) -> list[dict]:
    db = get_db()
    cursor = db.ml_preferences.find({'userId': user_id})
    return await cursor.to_list(length=100)


async def set_preference(user_id: str, pref: dict) -> dict:
    db = get_db()
    pref['userId'] = user_id
    await db.ml_preferences.update_one(
        {'userId': user_id, 'key': pref.get('key')},
        {'$set': pref},
        upsert=True,
    )
    return pref


async def delete_preference(user_id: str, key: str):
    db = get_db()
    await db.ml_preferences.delete_one({'userId': user_id, 'key': key})


async def reset_ml_data(user_id: str):
    db = get_db()
    await db.ml_examples.delete_many({'userId': user_id})
    await db.ml_feedback.delete_many({'userId': user_id})
    await db.ml_preferences.delete_many({'userId': user_id})
