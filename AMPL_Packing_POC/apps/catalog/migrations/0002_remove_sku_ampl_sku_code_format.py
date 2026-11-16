# M14: SKU codes have no naming rule any more (any characters allowed).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="sku",
            name="ampl_sku_code_format",
        ),
    ]
