from .settings import *

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "bridged",
        "USER": "postgres",
        "PASSWORD": "passme1$",
        "HOST": "localhost",
        "PORT": "5432",
        "TEST": {
            "NAME": "bridged_test_db_runner",
        },
    }
}
