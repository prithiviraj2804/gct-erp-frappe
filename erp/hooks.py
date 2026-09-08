app_name = "erp"
app_title = "Erp"
app_publisher = "Prithivi"
app_description = "A multi-tenant ERP for education groups"
app_email = "prithivi@gmail.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "erp",
# 		"logo": "/assets/erp/logo.png",
# 		"title": "Erp",
# 		"route": "/erp",
# 		"has_permission": "erp.api.permission.has_app_permission"
# 	}
# ]

# Frappe only creates Module Defs when an app is installed, so a module added to modules.txt
# afterwards would have none — and its doctypes would be silently deleted as orphans during the
# same migrate that imported them. See erp.utils.ensure_module_defs.
before_migrate = "erp.utils.ensure_module_defs"

# The vocabulary the app owns is re-asserted on every migrate rather than seeded once by a patch.
# A logged patch never runs again, so rows removed after it ran are gone for good — which is
# exactly what happened to Programme Level and Academic Structure on this bench, twice.
# See erp/seed.py.
after_migrate = "erp.seed.ensure_shared_vocabulary"

website_route_rules = [
	{"from_route": "/erp/<path:app_path>", "to_route": "erp"},
	{"from_route": "/erp", "to_route": "erp"},
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/erp/css/erp.css"
# app_include_js = "/assets/erp/js/erp.js"

# include js, css files in header of web template
# web_include_css = "/assets/erp/css/erp.css"
# web_include_js = "/assets/erp/js/erp.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "erp/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "erp/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "erp.utils.jinja_methods",
# 	"filters": "erp.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "erp.install.before_install"
# after_install = "erp.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "erp.uninstall.before_uninstall"
# after_uninstall = "erp.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "erp.utils.before_app_install"
# after_app_install = "erp.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "erp.utils.before_app_uninstall"
# after_app_uninstall = "erp.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "erp.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "erp.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways.
#
# Admission Enquiry is a CRM lead: a counsellor sees only the leads they own, an Admission
# Manager (or System Manager) sees all. `permission_query_conditions` scopes list/report views
# — and therefore the SPA, which reads over /api/resource — while `has_permission` mirrors it for
# single-record access. Both live in erp/api/permission.py.

# The `"*"` entry is the tenancy boundary and applies to every doctype carrying an `institution`
# column. Frappe supports the wildcard for both hooks — `database/query.py:1617` and
# `permissions.py:490` do `hooks.get(doctype, []) + hooks.get("*", [])` — and passes the doctype in,
# so one pair of functions scopes the whole app and picks up doctypes added later. A per-doctype
# list would be a list somebody forgets to append to, and forgetting means a silent cross-tenant
# read.
#
# The named entries below are a *different* rule that composes with it by AND: a counsellor sees
# only the leads they own, within the institution the wildcard already narrowed them to.
permission_query_conditions = {
	"*": "erp.api.permission.institution_scope_query",
	"Admission Enquiry": "erp.api.permission.admission_enquiry_query",
	"Admission Follow-up": "erp.api.permission.admission_followup_query",
	"Admission Application": "erp.api.permission.admission_application_query",
}

has_permission = {
	"*": "erp.api.permission.institution_has_permission",
	"Admission Enquiry": "erp.api.permission.admission_enquiry_has_permission",
	"Admission Follow-up": "erp.api.permission.admission_followup_has_permission",
	"Admission Application": "erp.api.permission.admission_application_has_permission",
}

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Auto-generate a UUID `id` column on every doctype that defines the field.
doc_events = {
	"*": {
		# Both, deliberately: `before_insert` is the only one that runs under `ignore_validate`,
		# and `before_save` is the only one that sees a child row appended to an existing parent.
		# See erp.utils.set_uuid_id — child rows get no hooks of their own at all.
		"before_insert": "erp.utils.set_uuid_id",
		"before_save": "erp.utils.set_uuid_id",
	},
	# The sign-in screen is branded from the Trust record, and that payload is cached in
	# redis for anonymous callers. Without this, an admin who uploads a logo would keep seeing
	# the old one until the TTL expired.
	"Trust": {
		# A new tenant gets its minimal chart of accounts so fee collection has somewhere to post.
		"after_insert": "erp.accounts.provisioning.setup_trust_accounts",
		"on_update": "erp.api.branding.clear_cache",
		"on_trash": "erp.api.branding.clear_cache",
	},
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"erp.tasks.all"
# 	],
# 	"daily": [
# 		"erp.tasks.daily"
# 	],
# 	"hourly": [
# 		"erp.tasks.hourly"
# 	],
# 	"weekly": [
# 		"erp.tasks.weekly"
# 	],
# 	"monthly": [
# 		"erp.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "erp.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "erp.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "erp.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "erp.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["erp.utils.before_request"]
# after_request = ["erp.utils.after_request"]

# Job Events
# ----------
# before_job = ["erp.utils.before_job"]
# after_job = ["erp.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"erp.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
