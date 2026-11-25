# Architecture v0.1
Prototype only. No authentication, database, scanner, real records or production deployment yet.
Proposed stack: Next.js, PostgreSQL/Supabase Auth, server-enforced permissions and row-level security.
Roles: super_admin, admin, teacher; no public self-registration. Teacher access scoped to teaching assignments. Admin registers students, rooms, subjects, teachers and terms.
Entities: profiles, academic_terms, students, rooms, enrollments, subjects, teaching_assignments, assignments, submissions, audit_events.
Unique submission per assignment/student. Separate submitted from graded and preserve null versus zero. Ranking counts distinct submitted assignments, with eligible assigned work as denominator; ties and historical term filtering to be implemented. No public student rankings. 
Legacy source uses Apps Script PropertiesService compressed JSON, not Sheets as primary storage. Migration requires sanitized JSON sample, dry run, validation and rollback. Never commit student data, LINE tokens or passwords. 
Before production: configure auth, RLS, secure exports, audit logging, backup, migration verification and device testing.
