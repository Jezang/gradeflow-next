// Pure preview only: no external writes or credentials.
export function gradebookCsvPreview(rows:readonly (readonly (string|number|null)[])[]):string {
 return rows.map(row=>row.map(value=>{
 if(value===null)return '""';
 let s=String(value);
 if(typeof value==='string'&&(/^[\s\uFEFF]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s)))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
 }).join(',')).join('\r\n');
}
