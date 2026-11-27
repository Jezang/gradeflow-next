import type {SourceTransaction} from './student-source-transaction';
type Row=Record<string,unknown>;
interface DocumentSnapshot {exists:boolean;data():Row|undefined}
interface QuerySnapshot {docs:readonly {id:string;data():Row}[]}
interface Query {where(field:string,operator:'==',value:string):Query;limit(count:number):Query}
export interface AdminSourceStore {doc(path:string):unknown;collection(path:string):Query}
export interface AdminSourceTransaction {getDocument(ref:unknown):Promise<DocumentSnapshot>;getQuery(query:Query):Promise<QuerySnapshot>}
export function adminSourceAdapter(store:AdminSourceStore,tx:AdminSourceTransaction):SourceTransaction{
 return {
 async getDocument(path){const snap=await tx.getDocument(store.doc(path));if(!snap.exists)return null;const data=snap.data();if(!data)throw Error('Missing document data');return data},
 async queryDocuments(path,filter,limit){if(!Number.isSafeInteger(limit)||limit<1||limit>501)throw Error('Invalid query limit');let query=store.collection(path);if(filter)query=query.where(filter.field,'==',filter.value);const snap=await tx.getQuery(query.limit(limit));if(snap.docs.length>limit)throw Error('Invalid query result');return snap.docs.map(d=>({id:d.id,data:d.data()}))}
 };
}
