import sys

from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = "api"

    def ready(self):
        is_manage = sys.argv[0].endswith("manage.py")
        is_server = len(sys.argv) > 1 and sys.argv[1] == "runserver"
        is_worker = not is_manage
        if is_server or is_worker:
            from api.scheduler import start

            start()
