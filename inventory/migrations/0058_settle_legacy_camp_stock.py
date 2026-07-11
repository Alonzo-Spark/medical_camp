from django.db import migrations, models


def settle_legacy_rows(apps, schema_editor):
    """Mark every pre-existing CampWiseStock row as already settled.

    Rows created under the old model already had their `allocated_stock`
    deducted from the global Medicine.stock at allotment time (and `returned_stock`
    added back on the old "update balances"). Under the new deferred-reconcile
    model, outstanding = allocated_stock - settled_used - returned_stock, and a
    non-zero outstanding is treated as stock still reserved out of global.

    To avoid double-counting that legacy allotment as a live reservation (which
    would make available-to-allot drop to zero), set settled_used so outstanding
    becomes 0 for every existing row, leaving global stock numbers unchanged:

        settled_used = max(0, allocated_stock - returned_stock)

    A later "Update Balances" on such a row still correctly returns the unused
    remainder to global (delta = used - settled = -(remaining)).
    """
    CampWiseStock = apps.get_model('inventory', 'CampWiseStock')
    rows = CampWiseStock.objects.all().only(
        'id', 'allocated_stock', 'returned_stock', 'settled_used'
    )
    to_update = []
    for cs in rows.iterator():
        settled = max(0, (cs.allocated_stock or 0) - (cs.returned_stock or 0))
        if cs.settled_used != settled:
            cs.settled_used = settled
            to_update.append(cs)
    if to_update:
        CampWiseStock.objects.bulk_update(to_update, ['settled_used'], batch_size=500)


def noop_reverse(apps, schema_editor):
    # Not reversible in a meaningful way; leave data as-is on downgrade.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0057_campwisestock_settled_used'),
    ]

    operations = [
        migrations.RunPython(settle_legacy_rows, noop_reverse),
    ]
