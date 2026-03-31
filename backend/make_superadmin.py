"""
Make a user superadmin.
Run inside the backend container:
    docker exec -it flowchat-backend-1 python make_superadmin.py test@flowwa.com
"""
import asyncio
import sys
from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models.user import User


async def grant(email: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"✗ User '{email}' not found")
            return
        user.is_superadmin = True
        await db.commit()
        print(f"✓ {email} is now superadmin")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python make_superadmin.py <email>")
        sys.exit(1)
    asyncio.run(grant(sys.argv[1]))
