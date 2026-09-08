// Copyright (c) 2026, Prithivi and contributors
// For license information, please see license.txt

// Filters only. Which institutions the report covers is not a filter and must not become one —
// it follows from who is running it, so that a Trust Admin cannot accidentally exclude an
// institution and an Institution Admin cannot include one.
frappe.query_reports["Admission Funnel"] = {
	filters: [
		{
			fieldname: "academic_year",
			label: __("Academic Year"),
			fieldtype: "Link",
			options: "Academic Year",
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
		},
	],
};
