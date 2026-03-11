from .settings import *

# Override DATABASES for testing with MySQL
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": "bridged_test_db",
        "USER": "root",
        "PASSWORD": "Passme1$",
        "HOST": "127.0.0.1",
        "PORT": "3306",
        "TEST": {
            "NAME": "bridged_test_db_runner",
        },
    }
}
