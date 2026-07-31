// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

frappe.ui.form.on("Staff", {
	institution(frm) {
		// The college picker is scoped to the institution; a college chosen under the
		// previous one is now cross-institution, so clear it rather than carry it into
		// a save the server will reject.
		if (frm.doc.college) {
			frm.set_value("college", null);
		}
	},
});
