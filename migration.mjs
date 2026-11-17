export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const stable=value=>JSON.stringify(sort(value));
function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;}
export function records(p){const m=new Map();for(const [date,rows] of Object.entries(p?.data||{}))for(const booking of rows){if(m.has(booking.id))throw Error('Deux réservations portent le même identifiant. La migration est arrêtée.');m.set(booking.id,{date,booking});}return m;}
export async function prepareLegacy(input){
 const result=structuredClone(input);result.data ||= {};result.history ||= {};result.tableSettings ||= {};const seen=new Set();
 for(const [date,rows] of Object.entries(result.data)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(rows))throw Error('Une date ou une liste de réservations est invalide. Aucune donnée n’a été modifiée.');
  for(const b of rows){
   if(typeof b.id!=='string'||!b.id.trim())throw Error('Une réservation ne possède aucun identifiant d’origine. Faites réconcilier ce cas avant de migrer cet appareil. Aucun rapprochement par nom ne sera effectué.');
   let id=b.id.toLowerCase();
   if(!UUID.test(id)){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('dipsy-tables:legacy-id:v1:'+b.id)));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;b.legacy_id=b.id;}
   if(seen.has(id))throw Error('Identifiant de réservation dupliqué : '+id+'. La migration est arrêtée.');seen.add(id);
   if(b.reservation_id&&b.reservation_id!==id)throw Error('L’identifiant partagé d’une réservation a changé. La migration est arrêtée.');
   b.id=id;b.reservation_id=id;
  }
 }
 return result;
}
// Three-way merge by UUID only. No name, telephone or table is an identity key.
export function mergePlan(local,remote,base={data:{}},choices={},tombstones=[]){
 const l=records(local),r=records(remote),b=records(base),data={},conflicts=[];
 for(const t of tombstones)if(!r.has(t.reservation_id))r.set(t.reservation_id,{date:t.visit_date,booking:t.booking,removed:true});
 for(const id of new Set([...r.keys(),...l.keys(),...b.keys()])){
  const lv=l.get(id),rv=r.get(id),bv=b.get(id);let chosen;
  if(stable(lv)===stable(rv))chosen=rv;
  else if(stable(lv)===stable(bv))chosen=rv;
  else if(stable(rv)===stable(bv))chosen=lv;
  else if(choices[id])chosen=choices[id]==='local'?lv:rv;
  else{conflicts.push({id,local:lv,remote:rv});continue;}
  if(chosen&&!chosen.removed)(data[chosen.date] ||= []).push(structuredClone(chosen.booking));
 }
 let settings;
 if(stable(local.tableSettings)===stable(remote.tableSettings)||stable(local.tableSettings)===stable(base.tableSettings))settings=remote.tableSettings;
 else if(stable(remote.tableSettings)===stable(base.tableSettings)||!Object.keys(remote.tableSettings||{}).length)settings=local.tableSettings;
 else if(choices.settings)settings=choices.settings==='local'?local.tableSettings:remote.tableSettings;
 else{conflicts.push({id:'settings',local:local.tableSettings,remote:remote.tableSettings});settings=remote.tableSettings;}
 const history={};
 for(const p of [remote,local])for(const [date,rows] of Object.entries(p.history||{}))for(const e of rows){const arr=history[date] ||= [];if(!e.id||!arr.some(x=>x.id===e.id))arr.push(structuredClone(e));else if(!arr.some(x=>stable(x)===stable(e)))arr.push({...structuredClone(e),id:`${e.id}:import:${arr.length}`});}
 return {payload:{...structuredClone(remote),...structuredClone(local),data,history,tableSettings:settings||{}},conflicts};
}
