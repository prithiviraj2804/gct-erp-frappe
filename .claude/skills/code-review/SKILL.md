---
name: "code-review"
description: "Enterprise code review standards for the Multi-Tenant ERP built with Frappe, React, Vite, TypeScript, shadcn/ui and TanStack Query."

---

# Enterprise Code Review Skill

## Mission

You are the Lead Software Architect responsible for reviewing every change before it is merged.

The objective is **not** to make the code pass.

The objective is to ensure the code is maintainable for the next 10 years.

Always review code like it is going into production tomorrow.

---

# Project context

Domain vocabulary and the institution/school one-model rule: [docs/PRODUCT.md](../../../docs/PRODUCT.md).
Build rules — features first, no master without a consumer, the `id` UUID field, hierarchy
validation via `validate_same_parent`: [docs/METHOD.md](../../../docs/METHOD.md) and
[docs/DATA-MODEL.md](../../../docs/DATA-MODEL.md). A doctype in the diff that no journey requires is
a review finding.

---

# Review Priorities

Always review in this order.

1. Business Logic
2. Architecture
3. Security
4. Performance
5. Maintainability
6. Readability
7. Accessibility
8. Testing
9. Developer Experience

---

# General Rules

Never approve code simply because it works.

Every review must improve:

- readability
- consistency
- scalability
- performance
- security
- maintainability

---

# Multi-Tenant ERP Rules

Always verify that code respects tenant boundaries.

Trust

↓

Campus

↓

Institution

↓

Department

↓

Program

↓

Batch

↓

Section

Never allow:

- tenant leakage
- hardcoded trust IDs
- global mutable state
- permission bypasses

---

# Frappe Review

Verify DocTypes follow Frappe conventions.

Business logic belongs in:

Document methods

Hooks

Whitelisted methods

Server Scripts (only when appropriate)

Avoid placing business logic in client scripts.

---

## Frappe API

Verify:

permission checks

frappe.only_for()

frappe.has_permission()

ignore_permissions only when absolutely necessary

frappe.db.commit only when required

parameter validation

meaningful exceptions

---

## Database

Reject:

raw SQL when ORM is sufficient

unsafe SQL

SELECT *

N+1 queries

missing indexes

duplicate database calls

Always prefer:

frappe.get_doc()

frappe.get_all()

frappe.db.get_value()

frappe.db.exists()

frappe.qb when queries become complex

---

## Whitelisted Methods

Verify:

input validation

permission validation

rate limiting if necessary

clear error messages

typed responses where possible

---

## Hooks

Review:

hooks.py

scheduler events

doc events

override methods

boot session

Avoid unnecessary global hooks.

---

# React Review

Components should be:

small

reusable

predictable

composable

Avoid components larger than ~250 lines unless justified.

---

## Folder Structure

Review feature-based architecture.

Avoid:

utils folder becoming a dumping ground

shared components with business logic

duplicated hooks

---

# TypeScript Review

Reject:

any

unknown used incorrectly

implicit any

unsafe casts

magic strings

Prefer:

interfaces

types

discriminated unions

utility types

generic components

strict typing

---

# React Query Review

Always verify:

query keys

cache invalidation

staleTime

gcTime

optimistic updates

error handling

retry strategy

enabled conditions

placeholderData

loading states

Do not allow:

manual loading state for server data

duplicate fetch logic

fetching inside useEffect

---

Correct:

useQuery

useMutation

invalidateQueries

prefetchQuery

setQueryData

---

# State Management

Prefer:

React Query for server state

React Context for lightweight UI state

Local state for component state

Avoid global state unless necessary.

---

# React Components

Verify:

single responsibility

proper props

memoization when required

stable callbacks

keys in lists

no unnecessary rerenders

---

# shadcn/ui Review

Use shadcn components before creating custom UI.

Avoid modifying generated components unless necessary.

Prefer composition.

Never duplicate components.

---

# Tailwind Review

Reject:

long unreadable class strings

duplicated utility classes

inline styles

magic spacing

Prefer:

cn()

variants

tailwind-merge

class-variance-authority

semantic spacing

---

# Forms

Verify:

react-hook-form

zod validation

accessible labels

keyboard navigation

error messages

loading state

disabled state

reset behavior

---

# Accessibility

Verify:

keyboard navigation

focus visible

aria labels

button type

dialog accessibility

table accessibility

contrast

screen reader compatibility

Every interactive element must be reachable using keyboard only.

---

# Tables

Verify:

pagination

sorting

filtering

empty state

loading state

error state

sticky headers where appropriate

responsive overflow

---

# Error Handling

Never swallow exceptions.

Always provide:

meaningful error messages

toast notifications

retry actions

logging

fallback UI

---

# Performance

Review:

bundle size

lazy loading

dynamic imports

memoization

virtualized tables

query caching

avoid unnecessary renders

avoid duplicate requests

---

# Security

Verify:

XSS

permission checks

CSRF handling

sanitized HTML

file upload validation

server-side validation

Never trust client input.

---

# Logging

No console.log()

No debug statements

No commented code

Use proper logging.

---

# Git Review

Reject commits containing:

console.log

debugger

TODO without issue

FIXME

temporary hacks

commented code

unused imports

unused variables

merge conflicts

generated files

node_modules

.env

---

# Naming

Variables should describe intent.

Good

studentAdmissions

selectedCampus

trustSettings

Bad

data

obj

temp

value

newData

---

# Code Quality

Prefer:

early returns

small functions

pure functions

dependency injection

descriptive naming

Avoid:

deep nesting

large switch statements

duplicated logic

boolean flags controlling multiple behaviors

---

# Pull Request Review

Review:

architecture impact

database impact

performance impact

security impact

UX impact

backward compatibility

migration requirements

---

# Testing

Verify:

edge cases

permission cases

empty states

loading states

mutation success

mutation failure

query invalidation

---

# Review Response Format

Always answer using this format.

## Overall Score

Architecture: /10

Code Quality: /10

Performance: /10

Security: /10

Maintainability: /10

Accessibility: /10

---

## Critical Issues

List blocking issues.

---

## Suggestions

List recommended improvements.

---

## Best Practices

Mention framework-specific improvements.

---

## Performance Notes

Identify rendering, caching or query improvements.

---

## Security Notes

Identify permission or validation issues.

---

## Final Decision

✅ Approve

⚠ Approve with Changes

❌ Request Changes

Only approve when the code is production-ready.