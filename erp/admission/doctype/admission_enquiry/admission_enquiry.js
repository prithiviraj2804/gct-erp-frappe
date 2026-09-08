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

frappe.ui.form.on("Admission Enquiry", {
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
