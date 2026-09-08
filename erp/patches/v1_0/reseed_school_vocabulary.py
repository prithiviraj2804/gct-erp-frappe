# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Re-run the school vocabulary seed, which is recorded as applied but did not land.

`seed_school_admission_config` sits in the Patch Log of the development site, yet the school
Programme Levels (Primary, Middle, Secondary, Higher Secondary) and the Term-system Academic
Structure it seeds are absent — whether because the rows were removed afterwards or because the
patch ran before that content was added to it. Either way a logged patch never runs again, so the
school half of the admission slice could not be exercised without this.

A *new* patch rather than an edit to the old one, for the reason `create_admission_manager_role`
spells out: an amended patch would never re-run on a site that already logged it. This one calls the
original's own seeding function rather than restating its data, so the two can never drift; that
function guards every row on `frappe.db.exists`, which is what makes running it twice harmless.
"""

from erp.patches.v1_0.seed_school_admission_config import seed_school_vocabulary


def execute():
	seed_school_vocabulary()
