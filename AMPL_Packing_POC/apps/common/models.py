from django.db import models, transaction


class IdCounter(models.Model):
    """
    Named counters (e.g. "BOX", "PRODUCT_UID").

    `allocate()` locks the row, so two requests can never receive the same
    value. Used for gapless BOX-000001 numbers and UID generation.
    """

    name = models.CharField(max_length=50, primary_key=True)
    next_value = models.BigIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ampl_id_counter"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(next_value__gte=1),
                name="ampl_id_counter_next_value_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} = {self.next_value}"

    @classmethod
    def allocate(cls, name: str, count: int = 1) -> int:
        """
        Reserve `count` consecutive values and return the first one.
        Must run inside the caller's transaction so a rollback also
        returns the values (keeps numbering gapless).
        """
        if count < 1:
            raise ValueError("count must be at least 1")
        with transaction.atomic():
            cls.objects.get_or_create(name=name)
            counter = cls.objects.select_for_update().get(name=name)
            first = counter.next_value
            counter.next_value = first + count
            counter.save(update_fields=["next_value", "updated_at"])
        return first
