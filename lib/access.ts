export type Role='super_admin'|'admin'|'teacher';
export function authorizedRole(p:Record<string,unknown>|undefined):Role|null{return p?.active===true&&(p.role==='super_admin'||p.role==='admin'||p.role==='teacher')?p.role:null;}
