// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

frappe.ui.form.on("Staff", {
	trust(frm) {
		// The institution picker is scoped to the trust; an institution chosen under the
		// previous one is now cross-trust, so clear it rather than carry it into
		// a save the server will reject.
		if (frm.doc.institution) {
			frm.set_value("institution", null);
		}
	},
});
