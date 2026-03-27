from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.scheduled_tasks.daily_cleanup")
def daily_cleanup():
    pass
