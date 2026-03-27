from celery import Celery
from app.config import settings

celery_app = Celery(
    "flowwa",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.flow_tasks",
        "app.tasks.broadcast_tasks",
        "app.tasks.scheduled_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    beat_schedule={
        "check-scheduled-broadcasts": {
            "task": "app.tasks.broadcast_tasks.check_scheduled_broadcasts",
            "schedule": 60.0,
        },
        "trigger-scheduled-flows": {
            "task": "app.tasks.flow_tasks.trigger_scheduled_flows",
            "schedule": 60.0,
        },
    },
)
