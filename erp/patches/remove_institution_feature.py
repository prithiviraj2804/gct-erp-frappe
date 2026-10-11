import frappe


def execute():
	# Remove the unused configuration DocType. Frappe retains its underlying table,
	# so existing rows are preserved rather than discarded during migration.
	if frappe.db.exists("DocType", "Institution Feature"):
		frappe.delete_doc("DocType", "Institution Feature", force=True)
