import {DefaultScheduler,Rating} from 'ts-fsrs';
import {concepts,countries,sideFor,type Concept} from './content';
export type Format='recognition'|'recall'|'comparison'|'clue'|'combined'|'difference'|'elimination';
export type Question={id:string;conceptId:string;variant:number;format:Format;prompt:string;clue:string;options:string[];answers:string[];hint:string};
export type Progress={id:string;attempts:number;correct:number;dates:string[];variants:number[];recent:boolean[];independent:number;last:number;due:number;card:any};
export type Attempt={id:string;conceptId:string;answer:string;correct:boolean;assisted:boolean;format:Format;time:number;date:string;responseMs:number;variant:number};
export const scheduler=DefaultScheduler({desiredRetention:.9,learningSteps:['1m','10m'],relearningSteps:['10m']});
export function normalize(s:string){return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/^(usa|us|america)$/,'united states').replace(/^uk$/,'united kingdom').replace(/^czech republic$/,'czechia');}
export function validateAnswer(q:Question,a:string){if(q.format==='elimination'){const values=a.split('|').map(normalize).sort();return JSON.stringify(values)===JSON.stringify(q.answers.map(normalize).sort());}return q.answers.some(x=>normalize(x)===normalize(a));}
export function generateQuestion(c:Concept,p?:Progress):Question{
 const variant=p?((p.attempts)%3):0; const recall=!!p&&p.correct>=3&&p.variants.length>=2;const driving=c.id.startsWith('drive');const fact=c.id.startsWith('fact');
 let answers=driving?[sideFor(c.country)!]:fact?[c.explanation]:[c.country];
 let options=driving?['left','right']:fact?[c.explanation,...concepts.filter(x=>x.id.startsWith('fact')&&x.id!==c.id).sort(()=>Math.random()-.5).slice(0,3).map(x=>x.explanation)]:[c.country,...countries.filter(x=>x!==c.country).sort(()=>Math.random()-.5).slice(0,3)];
 let format:Format=recall&&!fact?'recall':c.topic===11?'combined':fact?(c.topic===9?'difference':'clue'):variant===1?'comparison':'recognition';
 let prompt=driving?'Which side does traffic normally use?':fact?'Which interpretation is best supported?':'Which country does this evidence support?';
 if(c.topic===8&&variant===2&&!recall&&!driving){format='elimination';prompt='Which countries can you eliminate from this domain or language association?';answers=options.filter(x=>x!==c.country);}
 options=options.sort(()=>Math.random()-.5);
 return {id:crypto.randomUUID(),conceptId:c.id,variant,format,prompt,clue:driving?c.country:fact?c.clue:c.examples[variant],options,answers,hint:c.explanation};
}
export function selectNextQuestion(ps:Progress[],used:string[],mode:string,topic?:number):Concept|undefined{
 let pool=concepts.filter(c=>(topic===undefined||topic===10||c.topic===topic)&&!used.includes(c.id));
 if(mode==='Mixed Challenge')pool=pool.filter(c=>c.topic===11);
 if(mode==='Country Duel')pool=pool.filter(c=>c.topic===9);
 if(mode==='Daily Review')pool=pool.filter(c=>ps.some(p=>p.id===c.id&&p.due<=Date.now()));
 if(mode==='Learn New')pool=pool.filter(c=>!ps.some(p=>p.id===c.id));
 if(mode==='Review Weaknesses')pool=pool.filter(c=>ps.some(p=>p.id===c.id&&p.recent.includes(false)));
 return pool.map(c=>{const p=ps.find(x=>x.id===c.id);return {c,score:(p?(p.due<=Date.now()?45:0)+(p.recent.includes(false)?35:0)+Math.min(10,(Date.now()-p.last)/86400000):10)+Math.random()*15};}).sort((a,b)=>b.score-a.score)[0]?.c;
}
export function mastery(p?:Progress){if(!p)return 'Not learned';if(!p.correct)return 'Learning';if(p.dates.length>=5&&p.independent>0&&p.recent.length===5&&p.recent.every(Boolean)&&Date.parse(p.dates.at(-1)!)-Date.parse(p.dates[0])>=21*86400000)return 'Retained';if(p.dates.length>=3&&p.independent>0&&p.recent.filter(Boolean).length/p.recent.length>=.8&&p.recent.at(-1))return 'Strong';return 'Practicing';}
