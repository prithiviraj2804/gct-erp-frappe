// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

frappe.ui.form.on("College", {
	institution(frm) {
		// Same reasoning as Department: the campus picker is scoped to the institution,
		// so a campus held over from the previous one no longer belongs here.
		if (frm.doc.campus) {
			frm.set_value("campus", null);
		}
	},
});
