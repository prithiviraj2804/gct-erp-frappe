// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

frappe.ui.form.on("Programme", {
	college(frm) {
		// `institution` and `campus` re-fetch themselves from the new college, but
		// `department` does not — it would quietly stay pointed at the old college's
		// department and only fail on save. Drop it and make the user re-pick.
		if (frm.doc.department) {
			frm.set_value("department", null);
		}
	},
});
