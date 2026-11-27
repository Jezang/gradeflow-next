export interface VerifiedIdentity {uid:string;admin?:unknown;studentPublisher?:unknown}
export interface IdentityVerifier {verifyIdToken(token:string,checkRevoked:boolean):Promise<VerifiedIdentity>}
export async function authorizeStudentAdmin(verifier:IdentityVerifier,token:string):Promise<string|null>{
 if(!token)return null;
 try{const identity=await verifier.verifyIdToken(token,true);return identity.admin===true&&typeof identity.uid==='string'&&identity.uid.length>0?identity.uid:null}catch{return null}
}
export async function authorizeStudentPublisher(verifier:IdentityVerifier,token:string):Promise<boolean>{
 if(!token)return false;
 try{const identity=await verifier.verifyIdToken(token,true);return typeof identity.uid==='string'&&identity.uid.length>0&&(identity.admin===true||identity.studentPublisher===true)}catch{return false}
}
