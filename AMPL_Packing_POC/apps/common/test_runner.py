from django.test.runner import DiscoverRunner


class KeepDbTestRunner(DiscoverRunner):
    """
    Always reuse the test database instead of dropping and re-creating it.

    The shared PostgreSQL server's template gives new databases a `public`
    schema owned by `postgres`, so a freshly created test database is not
    writable by `ampl_poc_user`. The test database is prepared once (owner and
    schema fixed in pgAdmin) and then reused. Each test still runs inside a
    transaction that is rolled back, so no test data is left behind.
    """

    def __init__(self, *args, **kwargs):
        kwargs["keepdb"] = True
        super().__init__(*args, **kwargs)
