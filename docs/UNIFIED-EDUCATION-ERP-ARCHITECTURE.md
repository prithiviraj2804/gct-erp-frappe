# Unified Education ERP Architecture and Configuration Blueprint

**Status:** Product architecture recommendation  
**Scope:** Indian education groups operating schools, colleges, professional institutions, and multiple campuses  
**Last reviewed:** 11 October 2026

## Executive decision

A single ERP is the right approach for an education trust or group that operates schools and different kinds of colleges. The product should provide one identity system, one source of truth, one management panel, and consolidated reporting across the group.

The product should not impose one academic workflow on every institution. A school, engineering college, arts and science college, autonomous college, and medical college share administrative capabilities, but their academic structures, attendance rules, examinations, progression, and regulatory obligations differ. The appropriate model is one shared platform with isolated institution workspaces, configurable academic engines, and independently activated operational modules.

The product direction is therefore:

> One education group ERP, with shared governance and data foundations, institution-specific rules, and role-scoped workspaces.

## Operating model

```text
Education Group or Trust
├── Shared governance, HR, finance, procurement, and reporting
├── Campus A
│   ├── School
│   └── Engineering College
├── Campus B
│   ├── Arts and Science College
│   └── Nursing College
└── Central Services
    ├── Accounts
    ├── HR and Payroll
    ├── Procurement
    ├── Transport
    └── IT and Compliance
```

Users enter the same ERP but receive a workspace and data scope based on their assignments:

- Trust management sees consolidated information across authorized institutions.
- A principal or dean sees their institution.
- A campus administrator sees the institutions and facilities on that campus.
- A department head sees their department.
- Teachers see assigned classes, course offerings, and students.
- Students, applicants, guardians, and alumni see their own records and permitted services.
- Central HR, finance, procurement, and IT staff can work across selected institutions.

Oracle Campus Solutions uses a comparable configurable structure of institution, campus, academic organization, career, programme, plan, term, session, course, and class. It also provides shared setup values so common structures do not need to be copied into every institution. See [Oracle Campus Solutions academic structure](https://docs.oracle.com/cd/E29376_01/hrcs90r5/eng/psbooks/lsfn/htm/lsfn07.htm).

## Platform boundaries

### Shared platform services

The following capabilities should use common records and services across all institution types:

- Identity, authentication, and role assignments
- Person, household, guardian, and contact records
- Organization, campus, facility, department, and position records
- Documents, files, approvals, audit trails, and notifications
- Accounting, payments, procurement, assets, and budgets
- Employee records, payroll, leave, and attendance
- Communication, portals, reporting, and integration infrastructure
- Security, privacy, data retention, and operational monitoring

### Institution-specific academic behavior

The academic layer should support different strategies over shared foundational records.

| Area | School model | College and university model |
| --- | --- | --- |
| Structure | Grade, section, and subjects | Programme, curriculum, semester, and course offering |
| Admission | Entry-grade admission | Programme, quota, rank, and counselling-based admission |
| Attendance | Daily and period attendance | Course-hour, lecture, laboratory, and clinical attendance |
| Assessment | Tests, terms, competencies, and board examinations | Internal, external, practical, arrear, and credit-based assessment |
| Progression | Promotion to the next grade | Credit completion, semester progression, and degree audit |
| Guardian role | Normally required | Optional for adult students |
| Timetable | Class-section centred | Course, faculty, room, and batch centred |
| Completion | Transfer and board certificates | Degree, diploma, transcript, and credit records |

The code should avoid institution-type conditions scattered throughout modules. Academic behavior should be selected through explicit, versioned policies and rule sets.

## Tenancy and data isolation

One ERP site should normally serve one legal education group or trust. All institutions in that group can share the site when group leadership is entitled to consolidated access. Unrelated customers should use separate sites or tenants so operational mistakes, customizations, exports, and administrator access cannot cross customer boundaries.

Institution is the primary operational data boundary inside a site. Every institution-owned transaction should carry its institution and inherited trust. Records that operate at a smaller scope should also carry campus, academic organization, programme, or department where applicable.

Permissions must be based on scoped assignments rather than role names alone. A user may hold different roles in different institutions. For example, a person may be a Trust Auditor across the group, a lecturer in one college, and a guardian in one school.

Every institution-scoped feature must verify that an Institution Admin cannot list, open, change, delete, export, or report another institution's records.

## Configuration hierarchy

Configuration should resolve through an explicit inheritance hierarchy:

```text
Product Default
  ↓
Country or Regulatory Template
  ↓
Trust Policy
  ↓
Institution Policy
  ↓
Campus Policy
  ↓
Programme or Grade Policy
  ↓
Academic Year Override
```

A trust may define a standard receipt format, while one institution overrides its numbering prefix and a professional programme applies a different attendance threshold. The system should display the effective value and where that value came from.

Every configurable policy should include:

- Scope and owner
- Effective-from and effective-to dates
- Draft, published, superseded, and retired states
- Version and change reason
- Author, reviewer, and approval history
- Whether a lower scope can override the value
- Conflict validation
- Preview of the resolved value
- Links to the processes and records that consume it

Historical configurations must remain immutable after they affect official records. A result published under a 2025 curriculum must continue to use that curriculum after a newer version is introduced.

## Institution setup templates

Templates should accelerate initial setup without permanently restricting an institution. Recommended templates include:

- CBSE school
- ICSE school
- State-board school
- Matriculation school
- Affiliated semester college
- Autonomous college
- Engineering college
- Medical or health-sciences college
- Polytechnic
- University
- Vocational or skill institution

A template seeds terminology, regulatory identifiers, academic structures, roles, workflows, common policies, and suggested modules. Each seeded configuration remains independently editable after setup.

Examples:

- A school template can use Grade, Section, Subject, and Term.
- A college template can use Programme, Batch, Semester, Course, and Credit.
- A medical template can additionally configure clinical rotations, logbooks, competencies, and clinical attendance.

Institution Type should remain a classification taxonomy. It should not contain hidden business behavior.

## Required configuration catalogue

### Organization and legal identity

Configure:

- Trust, society, company, university, or governing body
- Legal name, registration, tax, and statutory identifiers
- Institutions operated by the trust
- Physical campuses, buildings, floors, rooms, and facilities
- Effective-dated institution-to-campus assignments
- Administrative and academic organization hierarchies
- Faculties, schools, divisions, departments, centres, and central-service units
- Governing bodies and committees
- Leadership positions and assignments with effective dates
- Institution branding, domains, letterheads, and communication identities
- Institution lifecycle states such as planned, active, suspended, merged, and closed

An institution must be able to operate on more than one campus, and one campus must be able to host multiple institutions.

### Regulatory profile

Configure:

- Education sector such as school, higher education, vocational, or continuing education
- School board or affiliating university
- Autonomous, affiliated, constituent, or degree-awarding status
- Regulating and approving authorities
- UDISE+, AISHE, ABC, and other external identifiers
- Approval, affiliation, recognition, and accreditation periods
- Accreditation agency, grade, score, scope, and validity
- Sanctioned programmes and approved intake
- Aided, unaided, government, private, minority, and similar classifications
- Coeducation or gender restrictions
- Mediums of instruction
- Required statutory returns and submission calendars
- Compliance evidence and renewal reminders

Approvals and accreditations should be normalized records with an authority, reference number, scope, supporting document, issue date, expiry date, and status. They should not be stored as unvalidated JSON.

CBSE requires affiliated schools to maintain records that include attendance, staff service records, financial documents, annual returns, infrastructure information, and other statutory evidence. See [CBSE affiliation requirements](https://www.cbse.gov.in/cbsenew/aff-bye-laws.html). UDISE+ collects school profile, infrastructure, student, and teacher information for each academic year. See [UDISE+](https://www.udiseplus.gov.in/).

### Localization

Configure:

- Country, state, district, and local jurisdiction
- Time zone
- Date, time, number, and currency formats
- Financial year
- Languages and translations
- Address and personal-name formats
- Working week and first day of the week
- National, regional, and institution holidays
- Tax rules
- Document language
- Identity-document types

### Academic calendar

Configure:

- Academic year
- Terms, semesters, trimesters, or annual cycles
- Sessions within a term
- Teaching dates
- Admission dates
- Examination and result windows
- Fee periods
- Holidays and closures
- Working-day exceptions
- Course registration and add-drop windows
- Attendance lock dates
- Calendar versions and publication status

Academic Pattern should be a reusable template. Actual dates belong to an institution and academic year.

### Academic organization and programme structure

Configure:

- Education stage and programme level
- Faculty, school, division, centre, and department hierarchy
- Programme and award type
- Branch, specialization, major, minor, and concentration
- Grade, standard, year, stage, or level
- Batch or cohort
- Section or group
- Subject and course catalog
- Course types such as theory, practical, project, clinical, and internship
- Credits, contact hours, teaching hours, and workload
- Prerequisites, co-requisites, anti-requisites, and equivalencies
- Programme outcomes, course outcomes, and competency frameworks
- Exit awards and completion requirements

The data model should separate:

- **Programme Catalog:** the durable definition, such as B.E. Computer Science.
- **Curriculum Version:** a regulation or syllabus version, such as Regulation 2026.
- **Programme Offering:** a programme offered by a particular institution for defined admission periods and approved intake.
- **Student Programme Enrolment:** one student's membership, status, and progression.
- **Course Offering:** a course taught in a term to specific sections, with assigned faculty, rooms, and schedules.

### Curriculum and credits

Configure:

- Curriculum versions and approval dates
- Stage, semester, or year structure
- Core, elective, foundation, skill, audit, and non-credit components
- Elective baskets and choice constraints
- Credit and contact-hour calculations
- Course sequencing
- Substitution and equivalency rules
- Transfer-credit evaluation
- Credit validity and expiry
- Multiple-entry and multiple-exit points
- Degree-audit and award requirements
- Curriculum transition rules for delayed and transferred students

The UGC Academic Bank of Credits framework supports credit recognition, accumulation, transfer, and redemption across eligible higher education institutions. See [UGC Academic Bank of Credits](https://www.ugc.gov.in/e-book/UGC_Regulation/files/basic-html/page555.html). The [National Credit Framework](https://www.ugc.gov.in/pdfnews/9028476_Report-of-National-Credit-Framework.pdf) connects school, higher education, vocational, and experiential learning.

### Admissions

Configure:

- Admission cycle and published offerings
- Entry grade or programme
- Applicant categories and quotas
- Seat matrix and approved intake
- Reservation rules
- Management, government, merit, sports, special, and lateral-entry routes
- Eligibility rules and qualifying examinations
- Required documents
- Dynamic application form schema
- Application numbering and fees
- Selection stages
- Entrance tests, interviews, and auditions
- Ranking and tie-breaking rules
- Counselling and allotment rounds
- Offer, acceptance, waitlist, and expiry rules
- Document verification
- Admission cancellation and refund rules
- Applicant-to-student conversion

Different admission routes should share the same applicant, application, offer, and enrolment foundation. School admissions should not be forced through college counselling workflows.

### Student lifecycle

Configure:

- Student identifiers and numbering
- Person matching and deduplication
- Guardian requirements
- Household and sibling relationships
- Profile and demographic fields
- Health, accessibility, and accommodation information
- Enrolment, registration, and re-registration
- Grade, section, batch, programme, and curriculum placement
- Promotion and progression
- Institution and programme transfers
- Break in study and re-entry
- Suspension, withdrawal, discontinuation, and expulsion
- Graduation and completion
- Alumni conversion
- Certificate, transcript, and transfer-certificate formats
- Record-retention policies

The same person may be a former student, employee, guardian, applicant, and alumnus. Person identity should therefore be separated from role-specific profiles.

### Timetable and attendance

Configure:

- Working days and period definitions
- Bell schedules
- Section and course-offering timetables
- Faculty workload limits
- Room, laboratory, equipment, and capacity constraints
- Substitution rules
- Daily, period, subject, course-hour, clinical, and biometric attendance modes
- Presence, absence, leave, late, duty, and exempt codes
- Leave approval
- Late-entry and early-departure rules
- Attendance correction workflow
- Minimum attendance and eligibility rules
- Condonation
- Parent and student notifications
- Attendance locks and audit controls

Attendance policies must be effective-dated and scoped because school boards, universities, and professional programmes apply different requirements.

### Assessment, examinations, and results

Configure:

- Assessment scheme and version
- Assessment components and weightages
- Formative, summative, internal, external, practical, project, clinical, and competency assessments
- Marks, grades, rubrics, competencies, and score scales
- Pass rules and component-level minimums
- Grace marks and moderation
- Best-of and exemption rules
- Absence, malpractice, incomplete, and withheld-result codes
- Revaluation, recounting, and challenge processes
- Supplementary and arrear examinations
- Promotion and progression rules
- GPA, CGPA, percentage, rank, and credit calculations
- Result review, approval, publication, and lock workflows
- Report card, marksheet, grade sheet, and transcript layouts
- Digital certificate issue and verification

School and higher-education assessments can share assessment events, components, attempts, scores, and approvals. Their calculation policies and official outputs should remain separately configurable.

### Fees and finance

Configure:

- Accounting company or legal entity
- Institution, campus, and department cost centres
- Chart of accounts
- Financial year and accounting periods
- Fee categories and fee plans
- Grade, programme, category, quota, and residency-based fee structures
- Instalments and due dates
- Deposits
- Scholarships, sponsorships, concessions, waivers, and discounts
- Sibling and staff benefits
- Fines and penalties
- Taxes
- Hostel, transport, examination, and activity charges
- Payment allocation order
- Refund and cancellation rules
- Receipt numbering and formats
- Payment gateways and bank accounts
- Bank reconciliation
- Budget and approval limits
- Inter-institution and central-service transactions
- Institution and consolidated financial statements

The student subledger must integrate with the general ledger. Charges, adjustments, payments, allocations, refunds, and write-offs should remain individually auditable.

### Human resources

Configure:

- Employee categories and employment types
- Teaching and non-teaching positions
- Position structure and sanctioned strength
- Qualifications and regulatory eligibility
- Institution, campus, and department assignments
- Multiple concurrent assignments
- Faculty workload
- Leave policies
- Staff attendance and shifts
- Payroll structures
- Performance and appraisal policies
- Faculty development and training
- Service records
- Contract, certification, and document expiry
- Transfer, deputation, separation, and retirement
- Substitute, adjunct, guest, and visiting faculty

A staff member may work in more than one institution. Permissions, workload, payroll allocation, and reporting should derive from effective-dated assignments.

### Campus operations

Provide independently activated modules for:

- Library
- Hostel and accommodation
- Transport
- Inventory and stores
- Procurement
- Assets
- Laboratories
- Facilities and room booking
- Maintenance
- Gate and visitor management
- Canteen
- Clinic and health
- Events
- Sports
- Placement and career services
- Research and grants
- Alumni
- Grievances, discipline, and safeguarding

These modules should use shared person, institution, facility, accounting, approval, document, and notification services.

### Documents, workflow, and communication

Configure:

- Document types and metadata
- Required documents by process and applicant category
- Templates, letterheads, and output formats
- Numbering series
- Digital signatures and verification
- Approval workflows
- Delegation of authority
- Escalation and service-level rules
- Email, SMS, push, and messaging providers
- Notification templates and language variants
- Communication consent and recipient preferences
- Applicant, student, guardian, employee, and alumni portals
- A shared action inbox across modules

### Security, privacy, and governance

Configure:

- Roles and permissions
- Institution, campus, department, programme, and cohort scopes
- Multiple scoped roles for one user
- Field-level restrictions
- Approval limits
- Segregation of duties
- Record ownership and sharing
- Complete audit history
- Authentication and multifactor policies
- Session, password, and device policies
- Data classification
- Consent and processing-purpose records
- Child-data handling
- Retention and erasure schedules
- Backup and disaster recovery
- Export and bulk-download controls
- Sensitive-data masking
- Security incident and breach handling

Privacy settings must be treated as enforceable policies, not descriptive fields. The system should record the purpose and scope of sensitive-data use, restrict exports, and preserve evidence of access and changes.

### Integrations and interoperability

Plan adapters for:

- Learning management systems
- Payment gateways and banks
- Biometric and access-control devices
- Email, SMS, push, and messaging providers
- Accounting and payroll services
- Library systems
- DigiLocker, NAD, ABC, and APAAR where applicable
- UDISE+, AISHE, and regulator exports
- Identity providers and single sign-on
- Video-conferencing systems
- Transport tracking
- Government scholarship and fee-reimbursement systems

OneRoster 1.2 defines interoperable exchange of organizations, users, courses, classes, enrolments, academic sessions, grading periods, resources, and gradebook results using CSV or REST. See [OneRoster 1.2](https://standards.1edtech.org/oneroster/specifications/standards/v1p2). Its support for users with multiple roles in multiple organizations is directly relevant to a multi-institution ERP. See the [OneRoster overview](https://www.1edtech.org/standards/oneroster).

Regulatory reports and integrations should be generated from canonical ERP records. The product should not maintain a second copy of student or employee data for each external report.

### Reporting and analytics

Configure:

- Reporting hierarchy and organizational rollups
- Common metric definitions
- Institution-specific targets
- Academic, attendance, admission, fee, finance, HR, and operational dashboards
- Row-level security
- Snapshot and as-of-date reporting
- Statutory report mappings
- Scheduled reports
- Data-quality rules
- Reconciliation reports
- Drill-down from group totals to authorized source records
- Anonymization for research and benchmarking

Consolidated metrics must use a shared definition registry so institutions do not calculate the same measure differently without disclosure.

## Module activation model

The removed free-text Institution Feature record should not be restored. It allowed arbitrary codes but did not control product behavior.

Optional modules should instead use a governed catalog after working modules exist:

```text
Module Definition
- stable module key
- product version
- dependencies
- compatible institution profiles
- required setup checks
- activation and retirement behavior

Institution Module Assignment
- institution
- module definition
- enabled from and enabled to
- lifecycle status
- configuration-completeness status
- activation approval
```

For example, activating Examinations may require a published academic calendar, curriculum version, course or subject offerings, student enrolments, assessment policy, and result approval workflow. The setup screen should explain incomplete prerequisites instead of exposing a manual capability code.

## Assessment of the current foundation

The existing foundation establishes several correct boundaries:

- Trust represents group ownership.
- Campus represents physical location.
- Institution represents the operational education unit.
- Institution-scoped records carry Trust for filtering and future permission enforcement.
- Institution Settings establish an initial institution configuration boundary.
- Academic Year, Academic Pattern, Programme Level, Department, and Programme provide an initial academic foundation.
- Hierarchy validation prevents linked records from silently crossing trust or institution boundaries.

The following changes should precede broad module development:

1. Replace the single Institution-to-Campus link with effective-dated Institution Campus Assignment records.
2. Normalize approval, affiliation, accreditation, and regulatory identifiers.
3. Replace principal, dean, and department-head text fields with Staff Position Assignment records.
4. Add Term and Session below Academic Year.
5. Separate Programme Catalog, Curriculum Version, Programme Offering, and Student Programme Enrolment.
6. Replace the flat department model with an effective-dated academic organization hierarchy.
7. Add configuration inheritance, versioning, publishing, and effective dates.
8. Add terminology configuration so the interface can use Grade or Year, Subject or Course, and Principal or Dean.
9. Add a setup-readiness service that reports missing prerequisites and invalid combinations.
10. Add governed module assignment only when the first optional module consumes it.

## Implementation sequence

### Phase 1 Organization foundation

Deliver multi-campus assignments, regulatory identities, approval and accreditation records, effective-dated organization hierarchy, staff position assignments, scoped roles, and permission tests.

### Phase 2 Configuration framework

Deliver configuration scope, inheritance, versioning, approval, publication, effective dating, resolved-value explanations, templates, terminology, and readiness checks.

### Phase 3 Academic core

Deliver academic year, term, curriculum, school grade or college programme offering, subject and course catalog, batches, sections, course offerings, and student enrolment.

### Phase 4 Admission to enrolment

Build a complete journey from enquiry or application through eligibility, selection, offer, document verification, payment, and enrolment. Prove the journey using one school and one college configuration.

### Phase 5 Timetable and attendance

Support both class-section and course-offering schedules, faculty workloads, facilities, substitutions, attendance modes, thresholds, correction, and eligibility.

### Phase 6 Assessment and results

Implement school and credit-based higher-education policies over common assessment records. Include approval, publication, correction, revaluation, supplementary attempts, report cards, grade sheets, and transcripts.

### Phase 7 Fees and accounting

Deliver fee plans, charges, scholarships, payments, allocations, refunds, receivables, payment gateway integration, and general-ledger posting.

### Phase 8 Operations and statutory integration

Add HR, library, transport, hostel, inventory, procurement, assets, facilities, and other operational modules as complete vertical slices. Add government and regulator integrations after their canonical source records are stable.

## Reference configurations for acceptance testing

Every foundational feature should be tested against these configurations:

- CBSE school
- State-board school
- Affiliated engineering college
- Autonomous arts and science college
- Professional college with practical or clinical requirements
- Two institutions sharing one campus
- One institution operating across two campuses
- Central employee assigned to multiple institutions
- User holding different roles in different institutions
- Student transferring between institutions or curricula

A feature is not ready for general use until its data isolation, configuration inheritance, historical behavior, and reporting work across the relevant reference configurations.

## Product principles

1. Share stable foundations, not every workflow.
2. Treat Institution as the operational security boundary.
3. Model Campus as a physical location, not as an institution type.
4. Keep configuration explicit, versioned, effective-dated, and explainable.
5. Separate catalog definitions from time-bound offerings and individual enrolments.
6. Preserve historical rules after official transactions use them.
7. Activate complete modules with validated dependencies, not arbitrary feature codes.
8. Build one complete user journey at a time.
9. Generate regulatory outputs from canonical records.
10. Require institution-isolation tests for every institution-scoped feature.

## Primary references

- [Oracle PeopleSoft Campus Solutions Academic Structure](https://docs.oracle.com/cd/E29376_01/hrcs90r5/eng/psbooks/lsfn/htm/lsfn07.htm)
- [1EdTech OneRoster 1.2 Standard](https://standards.1edtech.org/oneroster/specifications/standards/v1p2)
- [1EdTech OneRoster Overview](https://www.1edtech.org/standards/oneroster)
- [Ed-Fi Education Organization Domain](https://docs.ed-fi.org/reference/data-exchange/data-standard/model-reference/education-organization-domain/)
- [UDISE+](https://www.udiseplus.gov.in/)
- [AISHE Higher Education Institution Directory](https://dashboard.aishe.gov.in/)
- [UGC Academic Bank of Credits Regulations](https://www.ugc.gov.in/e-book/UGC_Regulation/files/basic-html/page555.html)
- [UGC National Credit Framework](https://www.ugc.gov.in/pdfnews/9028476_Report-of-National-Credit-Framework.pdf)
- [CBSE Affiliation Requirements](https://www.cbse.gov.in/cbsenew/aff-bye-laws.html)

