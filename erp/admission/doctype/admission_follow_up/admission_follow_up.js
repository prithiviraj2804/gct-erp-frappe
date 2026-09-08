// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

frappe.ui.form.on("Admission Follow-up", {
	enquiry(frm) {
		// The lead owns the tenant and the counsellor; surface them as soon as one is picked so the
		// person logging the call can confirm they are on the right student.
		if (frm.doc.enquiry) {
			frm.trigger("refresh");
		}
	},
});
