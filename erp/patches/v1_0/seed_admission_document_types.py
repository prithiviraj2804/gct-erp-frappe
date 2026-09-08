# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Seed the document checklist vocabulary an Indian admission is verified against.

These are not a tenant's own data — every institution and school in the country asks for the same core
set — so they are seeded once here rather than keyed in on every site. *Which* of them a given
intake requires is per-tenant configuration and lives on `Programme Intake.required_documents`; this
patch only supplies the names to choose from.

The set spans both halves of the app deliberately: a birth certificate and a transfer certificate
are what a school asks a five-year-old for, mark sheets and a counselling allotment order are what an
engineering institution asks a TNEA candidate for, and they sit in one list because one
`Admission Application` serves both.

Runs in `[post_model_sync]`: the doctype must exist before rows can be written. Idempotent — each
row guards on what is already there, so re-running on any installed site is a no-op.
"""

import frappe

DOCUMENT_TYPES = (
	{"document_code": "MARK10", "document_name": "10th Mark Sheet"},
	{"document_code": "MARK12", "document_name": "12th Mark Sheet"},
	{"document_code": "TC", "document_name": "Transfer Certificate"},
	{"document_code": "CONDUCT", "document_name": "Conduct Certificate"},
	{"document_code": "COMMUNITY", "document_name": "Community Certificate"},
	{"document_code": "NATIVITY", "document_name": "Nativity Certificate"},
	{"document_code": "INCOME", "document_name": "Income Certificate"},
	{"document_code": "AADHAAR", "document_name": "Aadhaar Card"},
	{"document_code": "BIRTH", "document_name": "Birth Certificate"},
	{"document_code": "MIGRATION", "document_name": "Migration Certificate"},
	{"document_code": "ALLOTMENT", "document_name": "Provisional Allotment Order"},
	{"document_code": "PHOTO", "document_name": "Passport Photograph"},
)


def execute():
	for document in DOCUMENT_TYPES:
		if frappe.db.exists("Admission Document Type", document["document_code"]):
			continue

		frappe.get_doc({"doctype": "Admission Document Type", **document}).insert(ignore_permissions=True)
