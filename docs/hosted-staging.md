# Student Portal on Vercel Preview

Use an existing Vercel account and a dedicated Firebase test project within their current no-cost limits. Seed fictional students, teachers, rooms and scores only. Keep the deployment private using protections already available on the account. Leave the deployment uncreated if the necessary protection or resources require a paid plan.

## Configure the Preview deployment

1. In the Firebase test project, register a web app, enable Email/Password Authentication and prepare Firestore. Add only the exact Preview host under Authentication → Authorized domains. Verify the selected project in the Firebase console before applying this branch's Firestore rules to the **test project**.
2. In Vercel → Project Settings → Environment Variables, set the variables in [the template](../.env.example) for **Preview**, preferably scoped to the feature branch. Use the four values from the same Firebase test web app. Use the canonical `<project-id>.firebaseapp.com` Auth domain and set `STUDENT_PORTAL_PROJECT_ID` to the same ID. This app reads Vercel's system environment variables to select Preview or Production. Expose those system variables to the deployment.
3. Provide `STAGING_FIREBASE_ADMIN_CREDENTIALS_JSON` as a sensitive server-only variable. Use a dedicated identity in that test project with only permissions needed for test Authentication administration, token signing and Firestore reads and writes. Store the JSON in Vercel, without the `NEXT_PUBLIC_` prefix. Rotate or remove the test credential when it is retired.
4. The three portal switches in the template default to false. Set them to true only for the isolated Preview. In that Firebase test project, create the trusted document `portalConfig/student` with `enabled: true`. Seed an approved synthetic staff profile with an `admin: true` Firebase custom claim and a separate synthetic student.
5. Create a Preview of the feature branch from the existing Vercel project only after verifying that the action fits the current plan. This repository configures automatic Git deployments for `main` only. Use a manual Preview deployment without selecting Production or promoting the Preview. Redeploy Preview after changing browser variables, which Next.js embeds at build time.

Browser Firebase clients, including staff screens, select the staging project on Preview. Missing or invalid staging configuration fails closed. The student API checks that the browser project, server project and staging credential identify the same project before creating the Admin SDK clients. The known Production Firebase configuration is reserved for Vercel Production staff workflows. Student Portal pages and APIs stay closed in Production in this branch.

## Exercise a synthetic transfer and promotion

1. Prepare the source and destination rooms, terms and teaching assignments. Add the fictional student to the source roster. In `/student-admin`, select **ย้ายห้องในภาคเรียนเดิม** for a transfer or **เลื่อนชั้นไปภาคเรียนใหม่** for a promotion.
2. Enter the student, rooms, terms and the effective time in Bangkok time. A transfer closes old membership windows and opens destination membership within that term. A promotion opens destination membership in a new term and retains the old term. Existing submissions and score history remain in their original courses.
3. If the destination term has published results, withdraw it before making the change. Publish the destination term afterward and sign in as the student to check results on both sides of the effective time.
4. Test unauthenticated access, non-admin access, a retry of the same operation, failed moves and access to another student's results. Verify that the old term remains available after promotion. Use synthetic data for Scanner and mobile checks.

For loopback development, use the Auth and Firestore emulators with project `demo-gradeflow` and the existing demo flag `NEXT_PUBLIC_STUDENT_PORTAL_DEMO_EMULATORS=true`. Use ports 9099 and 8080 for the browser clients, an emulator-only signing credential, and the three local portal switches. Without Preview, Vercel Production, or the explicit demo flag, Firebase access is disabled.
