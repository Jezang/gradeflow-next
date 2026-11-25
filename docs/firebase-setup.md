# Firebase v0.2 foundation
1. Firebase Console > Authentication > Get started > Sign-in method > Google > Enable. Choose support email and save.
2. Authentication > Settings > Authorized domains > Add gradeflow-next.vercel.app. For testing, authorize only specific trusted preview domains if needed.
3. Firestore Database > Create database > Standard edition (if offered) > Production mode. Choose location carefully; location cannot normally be changed in place.
4. Publish the exact firestore.rules in this repository in Firestore > Rules. This initial policy denies all access except authenticated users reading their own profile. Do not enter student data yet.
5. After deployment, visit /login and sign in. Authentication > Users gives the UID. Create a profiles document with document ID equal to the UID, role string super_admin and active boolean true in the console. Never allow clients to assign roles.
6. Login route is a proof of authentication and profile lookup only. Existing dashboard remains a public demo; no protected real data or actual admin workflows yet. No Supabase environment variables required. Do not commit service account keys. Firebase web config is public, not an authorization mechanism.
