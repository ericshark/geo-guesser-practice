import Dexie,{type EntityTable} from 'dexie';
import {z} from 'zod';
import {scheduler,validateAnswer,type Question,type Progress,type Attempt} from './engine';
const database=new Dexie('geoguessr-academy') as Dexie & {progress:EntityTable<Progress,'id'>;attempts:EntityTable<Attempt,'id'>;state:EntityTable<{id:string;value:any},'id'>;reviews:EntityTable<{id:string;value:any},'id'>};
database.version(1).stores({progress:'id,due',attempts:'id,conceptId,time',state:'id',reviews:'id'});export const db=database;
export async function recordAttempt(q:Question,answer:string,assisted:boolean,responseMs:number){
 const s=await scheduler;return db.transaction('rw',db.progress,db.attempts,db.reviews,db.state,async()=>{
 if(await db.attempts.get(q.id))return;const now=new Date(),correct=validateAnswer(q,answer),old=await db.progress.get(q.conceptId);
 const date=new Intl.DateTimeFormat('en-CA').format(now); const a:Attempt={id:q.id,conceptId:q.conceptId,answer,correct,assisted,format:q.format,time:+now,date,responseMs,variant:q.variant};
 let card=old?.card??s.newCard({cardId:q.conceptId,now});
 if(!correct||!assisted){const result=s.review({card,grade:correct?3:1,now});card=result.card;await db.reviews.put({id:q.id,value:result.revlog});}
 await db.attempts.add(a);await db.progress.put({id:q.conceptId,attempts:(old?.attempts??0)+1,correct:(old?.correct??0)+Number(correct),dates:[...new Set([...(old?.dates??[]),...correct&&!assisted?[date]:[]])],variants:[...new Set([...(old?.variants??[]),q.variant])],recent:[...(old?.recent??[]),correct&&!assisted].slice(-5),independent:(old?.independent??0)+Number(correct&&!assisted&&q.format==='recall'),last:+now,due:+new Date(card.dueAt),card});
 const active=await db.state.get('session');if(active)await db.state.put({id:'session',value:{...active.value,feedback:a}});
 });
}
export async function exportData(){return {version:1,contentVersion:1,schedulerVersion:'6/FSRS-7',progress:await db.progress.toArray(),attempts:await db.attempts.toArray(),reviews:await db.reviews.toArray(),state:await db.state.toArray()};}
const backup=z.object({version:z.literal(1),contentVersion:z.number(),schedulerVersion:z.string(),progress:z.array(z.object({id:z.string(),attempts:z.number(),correct:z.number(),dates:z.array(z.string()),variants:z.array(z.number()),recent:z.array(z.boolean()),independent:z.number(),last:z.number(),due:z.number(),card:z.object({dueAt:z.union([z.string(),z.date()])}).passthrough()})),attempts:z.array(z.object({id:z.string(),conceptId:z.string(),answer:z.string(),correct:z.boolean(),assisted:z.boolean(),format:z.enum(['recognition','recall','comparison','clue','combined','difference','elimination']),time:z.number(),date:z.string(),responseMs:z.number(),variant:z.number()})),reviews:z.array(z.object({id:z.string(),value:z.any()})),state:z.array(z.object({id:z.string(),value:z.any()}))});
export function parseBackup(input:unknown){return backup.parse(input);}
export async function importData(input:unknown){const b=parseBackup(input);for(const p of b.progress){p.card.dueAt=new Date(p.card.dueAt);if(p.card.lastReviewAt)p.card.lastReviewAt=new Date(p.card.lastReviewAt as string);}await db.transaction('rw',db.tables,async()=>{for(const t of db.tables)await t.clear();await db.progress.bulkPut(b.progress as Progress[]);await db.attempts.bulkPut(b.attempts);await db.reviews.bulkPut(b.reviews);await db.state.bulkPut(b.state);});}
