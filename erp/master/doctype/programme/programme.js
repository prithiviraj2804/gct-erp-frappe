// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

frappe.ui.form.on("Programme", {
	institution(frm) {
		// `trust` and `campus` re-fetch themselves from the new institution, but
		// `department` does not — it would quietly stay pointed at the old institution's
		// department and only fail on save. Drop it and make the user re-pick.
		if (frm.doc.department) {
			frm.set_value("department", null);
		}
	},
});
