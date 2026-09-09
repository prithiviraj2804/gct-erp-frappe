// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

/**
 * Fill the rule grid's field picker from the doctype the policy governs.
 *
 * `fieldname` used to be a free-text `Data` column, which meant an operator had to already know
 * the exact snake_case fieldname — and got `Admission Enquiry has no field None` for a blank row,
 * `has no field Entrance Rank` for the label, and the same error for a typo. Correct errors, all
 * three, and useless: nothing told them what the valid answers were.
 *
 * The options come from `governable_fields`, which returns only fields that will pass every guard
 * in `Field Policy.validate` — so a field you can pick is a field that saves. Presentation only,
 * as always here: `validate()` re-checks the choice server-side for every writer, including the
 * ones that never load this script.
 *
 * ## `type: "GET"` is load-bearing
 *
 * `frappe.call` defaults to POST (`request.js:110`), and `governable_fields` is declared
 * `methods=["GET"]` because it is a read. The mismatch is a **403**, which Desk surfaces as a
 * permission error — so the first version of this script made a form the user administers report
 * itself as not permitted, with nothing in the message about an HTTP verb.
 * `erp/api/test_conventions.py` now asserts every `erp.*` call in this app's Desk scripts uses a
 * verb its endpoint accepts.
 */
frappe.ui.form.on("Field Policy", {
	refresh: (frm) => set_field_options(frm),
	document_type: (frm) => {
		set_field_options(frm);

		// Warn, never clear. An earlier version called `frm.clear_table("rules")` here on the
		// reasoning that the old doctype's fieldnames are no longer valid answers — which is true,
		// and not worth the risk: this trigger fires on any change to the field, and a script that
		// can silently discard an operator's whole policy is a worse failure than the one it
		// prevents. The server already refuses a stale rule by name, which is a message they can
		// act on.
		if (frm.doc.rules && frm.doc.rules.length) {
			frappe.show_alert({
				message: __("Check the rules — they may name fields of the previous doctype."),
				indicator: "orange",
			});
		}
	},
});

function set_field_options(frm) {
	const grid = frm.fields_dict.rules && frm.fields_dict.rules.grid;
	if (!grid) return;

	if (!frm.doc.document_type) {
		grid.update_docfield_property("fieldname", "options", []);
		return;
	}

	frappe.call({
		method: "erp.api.field_policy.governable_fields",
		type: "GET",
		args: { document_type: frm.doc.document_type },
		callback: ({ message }) => {
			grid.update_docfield_property("fieldname", "options", message || []);
			frm.refresh_field("rules");
		},
	});
}
