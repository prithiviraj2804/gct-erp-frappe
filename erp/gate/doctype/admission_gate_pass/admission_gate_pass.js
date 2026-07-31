// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

// Only these two are records. `student_reference` and the three `reference_staff_*` slots
// are typed names, so they carry no institution and nothing about them can go stale.
const LINKED_REFERRER_FIELDS = ["staff_reference", "consultancy"];
const ROUTE_FIELDS = [...LINKED_REFERRER_FIELDS, "student_reference", "source_details"];

frappe.ui.form.on("Admission Gate Pass", {
	college(frm) {
		// `institution` re-fetches itself from the new college; the two link pickers do not.
		// They would stay pointed at the previous institution's staff and agencies and only
		// fail on save, so drop them and make the desk re-pick. The typed names are left
		// alone — re-keying a person's name because the college was corrected is busywork.
		for (const field of LINKED_REFERRER_FIELDS) {
			if (frm.doc[field]) {
				frm.set_value(field, null);
			}
		}
	},

	reference(frm) {
		// The server blanks the routes it did not choose on save; clearing here means the
		// form never shows a referrer that belongs to the route the desk just moved off.
		for (const field of ROUTE_FIELDS) {
			if (frm.doc[field]) {
				frm.set_value(field, null);
			}
		}
	},

	refresh(frm) {
		if (frm.is_new() || frm.doc.status !== "Inside") {
			return;
		}

		frm.add_custom_button(__("Mark Exit"), () => {
			// Marking the exit reloads the document, which throws away anything unsaved. The
			// desk edits a pass and stamps the exit from the same screen, so refusing here is
			// the difference between a corrected phone number and a lost one.
			if (frm.is_dirty()) {
				frappe.throw({
					title: __("Unsaved Changes"),
					message: __("Save this pass before marking the exit."),
				});
			}

			// The exit stamp is taken on the server. A gate log is evidence of when someone
			// left, and the clock on a desk workstation is neither reliable nor beyond reach
			// of the person being logged.
			frappe.call({
				method: "erp.api.gate.mark_exit",
				args: { pass_name: frm.doc.name },
				freeze: true,
				freeze_message: __("Marking exit..."),
				callback: () => frm.reload_doc(),
			});
		}).addClass("btn-primary");
	},
});
