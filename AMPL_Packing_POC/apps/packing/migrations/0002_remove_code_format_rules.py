# M14: box configuration and section codes have no naming rule any more (any characters allowed).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("packing", "0001_initial"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="boxconfiguration",
            name="ampl_box_configuration_code_format",
        ),
        migrations.RemoveConstraint(
            model_name="packingsection",
            name="ampl_packing_section_code_format",
        ),
    ]
