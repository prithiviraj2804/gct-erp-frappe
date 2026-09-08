// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

// The visitor's details the gate desk already captured, pulled onto the enquiry when a pass is
// picked. `trust`, `campus` and `academic_year` are left out on purpose: `trust` and
// `campus` re-fetch themselves from the institution, and `academic_year` is stamped on the server from
// the trust's open admission cycle.
const GATE_PASS_CARRY_FIELDS = [
	"student_name",
	"phone_number",
	"aadhaar_number",
	"parent_name",
	"native_place",
	"institution",
	"reference",
	"staff_reference",
	"consultancy",
	"student_reference",
	"source_details",
];

// Fields this form may be told to hide, require or relabel, depending on the institution. The
// answer comes from the server (`erp.api.field_policy.get_policy`) because it is composed from the
// trust, the institution type and its ancestors, and the institution — none of which the browser
// can work out for itself.
//
// This is presentation only. The same policy is applied again in `validate()`, so a field hidden
// here is also refused on the server, and a field this script fails to hide is still refused there.
// Nothing below is a security boundary.
function apply_field_policy(frm) {
	if (!frm.doc.institution) {
		return;
	}

	frappe.call({
		method: "erp.api.field_policy.get_policy",
		args: {
			document_type: frm.doctype,
			institution: frm.doc.institution,
		},
		callback(r) {
			const policy = r.message || {};

			for (const [fieldname, rule] of Object.entries(policy)) {
				const field = frm.get_field(fieldname);
				if (!field) {
					continue;
				}

				const hidden = rule.requirement === "Hidden";
				frm.set_df_property(fieldname, "hidden", hidden ? 1 : 0);
				frm.set_df_property(fieldname, "reqd", rule.requirement === "Required" ? 1 : 0);
				frm.set_df_property(
					fieldname,
					"read_only",
					rule.requirement === "Read Only" ? 1 : field.df.read_only || 0,
				);

				if (rule.label) {
					frm.set_df_property(fieldname, "label", rule.label);
				}
				if (rule.description) {
					frm.set_df_property(fieldname, "description", rule.description);
				}
			}

			frm.refresh_fields();
		},
	});
}

frappe.ui.form.on("Admission Enquiry", {
	refresh(frm) {
		apply_field_policy(frm);
	},

	// The institution is what selects the policy, so changing it redraws the form. A counsellor
	// who picks the school after typing an entrance rank sees the field go away, and the server
	// then declines to store what they typed.
	institution(frm) {
		apply_field_policy(frm);
	},

	gate_pass(frm) {
		// Clearing the pass leaves whatever was already typed — the counsellor may have corrected
		// a value and should not lose it because they detached the pass.
		if (!frm.doc.gate_pass) {
			return;
		}

		// Fetch the desk's record and lay it onto the enquiry so its details show at once. Name,
		// phone and institution are a starting point the counsellor may correct; the Aadhaar and the
		// reference block are greyed by `read_only_depends_on` and re-enforced on the server, so
		// setting them here only fills what the form then shows read-only. Setting `institution` lets
		// its own `fetch_from` fill trust and campus; `academic_year` follows on save.
		frappe.db
			.get_value("Admission Gate Pass", frm.doc.gate_pass, GATE_PASS_CARRY_FIELDS)
			.then((r) => {
				const pass = r.message;
				if (!pass) {
					return;
				}

				for (const field of GATE_PASS_CARRY_FIELDS) {
					if (pass[field]) {
						frm.set_value(field, pass[field]);
					}
				}
			});
	},
});
