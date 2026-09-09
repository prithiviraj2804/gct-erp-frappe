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
 */
frappe.ui.form.on("Field Policy", {
	refresh: (frm) => set_field_options(frm),
	document_type: (frm) => {
		// The old doctype's fields are no longer valid answers, so clear the rules rather than
		// leave rows that will throw on save with no visible cause.
		if (frm.doc.rules && frm.doc.rules.length) {
			frm.clear_table("rules");
			frm.refresh_field("rules");
			frappe.show_alert({
				message: __("Rules cleared — they named fields on the previous doctype."),
				indicator: "orange",
			});
		}
		set_field_options(frm);
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
		args: { document_type: frm.doc.document_type },
		callback: ({ message }) => {
			grid.update_docfield_property("fieldname", "options", message || []);
			frm.refresh_field("rules");
		},
	});
}
