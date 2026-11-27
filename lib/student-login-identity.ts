export function studentLoginAlias(studentNumber:string):string{
 const id=studentNumber.trim();
 if(!/^[0-9]{1,32}$/.test(id))throw Error('Invalid student number');
 return 'student-'+id+'@students.gradeflow.invalid';
}
export function validStudentPassword(studentNumber:string,password:string):boolean{
 return password.length>=10&&password.length<=128&&password!==studentNumber.trim()&&password.trim()===password;
}
