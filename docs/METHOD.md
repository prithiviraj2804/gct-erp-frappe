# Development method

Build one complete journey at a time. A slice must include its data model, server validation,
permissions, API behavior, SPA flow, migration, tests, and documentation.

Do not create a master until a working journey consumes it. Use standard Frappe REST CRUD for a
single document and a whitelisted POST command for a transactional operation spanning documents.

Every institution-scoped feature must prove that an Institution Admin cannot list, open, mutate,
export, or report another institution's records.
