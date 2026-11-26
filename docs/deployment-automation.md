# GradeFlow deployment automation

Vercel: keep dashboard Ignored Build Step = Only build production, production branch = main. vercel.json limits automatic Git deployment to main on branches that contain that file; older branches may still create skipped deployments. New work should branch from updated main. Verify on Vercel after merge.

CI: use Node 22; pure unit tests in build job, rules and recovery in local demo-gradeflow emulator. Existing separate workflows remain intact for now. Never use real student data in CI.

Firebase rules publication is manual, not triggered by pull requests or merges. After reviewing and merging this PR, configure the GitHub environment firebase-production to allow only main and require an authorized reviewer if feasible. Set up Google Cloud Workload Identity Federation for GitHub Actions using a dedicated rules-deployment service account in gradeflow-next. Restrict the provider/identity binding to this exact repository, main branch, and firebase-rules-release workflow; use immutable repository/owner IDs where supported. Grant only the permissions needed to publish Firestore rules and read project metadata; do not grant Owner, Editor, or database data-write roles. Confirm IAM requirements using the official Firebase CLI and Google Cloud docs. Configure environment variables FIREBASE_WIF_PROVIDER and FIREBASE_RULES_SERVICE_ACCOUNT; these are resource identifiers, not private keys. Do not generate or paste service account JSON into chat or repository. Never allow fork or PR workflows to assume this identity.

After comparing the production rules with the reviewed git version, owner opens Actions > Publish Firebase rules > Run workflow on main and types PUBLISH gradeflow-next. The job retests rules and recovery against emulator, checks main SHA, requests short-lived credentials and publishes only rules. Review workflow output and verify Firebase Console. Publication replaces existing console rules; preserve the currently deployed rules securely first. Do not run until WIF/environment restrictions and IAM have been independently checked. Existing data and Auth users are not migrated. CLI authentication and actual deployment have not been tested. If setup is not ready, continue using manual console publication.

References:
- https://vercel.com/docs/project-configuration/git-configuration
- https://firebase.google.com/docs/rules/manage-deploy
- https://github.com/google-github-actions/auth
- https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
