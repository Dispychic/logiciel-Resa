import {createCaisseTools} from './caisse-tools.js';
import {createClient} from '@supabase/supabase-js';
import {prepareLegacy,mergePlan,records,stable,UUID} from './migration.mjs';
const PROJECT='https://wseewiaaygyzkalpslee.supabase.co',KEY='sb_publishable_1iZmfQuTCvGOX1Cyjoutdw_4_VZm23k';
const CAISSE='https://steven77726.github.io/DIPSY-CAISSE/',CAISSE_ORIGIN=new URL(CAISSE).origin;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function connect(api){
 const authClient=createClient(PROJECT,KEY,{auth:{storageKey:'dipsy-tables-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const freeClient=createClient(PROJECT,KEY,{auth:{storageKey:'dipsy-tables-free',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});let client=authClient,freeAccess=false;
 let session=null,role=null,ready=false,baseline=null,revision=0,pending=null,busy=false,suppress=false,timer=null,channel=null,remoteConflict=null;
 const caisseTools=createCaisseTools({client:{rpc:(...args)=>client.rpc(...args)},access:()=>({session,role,ready}),openReservation,onPayments:(states,confirmed)=>api.payments?.(states,confirmed)});
 const marker=()=> 'dipsy-bridge-migrated-device-v1',queueKey=()=>`dipsy-tables-outbox-${session?.user.id}`,baseKey=()=> 'dipsy-tables-confirmed-base-v1';
 const dialog=document.createElement('dialog');dialog.className='table-dialog bridge-dialog';dialog.setAttribute('aria-label','Passerelle Dipsy Caisse');document.body.append(dialog);
 const notice=document.createElement('section');notice.className='panel bridge-notice';notice.setAttribute('aria-live','polite');document.querySelector('header').after(notice);
 const authButton=document.createElement('button');authButton.type='button';authButton.className='btn';authButton.textContent='Connexion sécurisée';document.querySelector('.top-actions').append(authButton);
 function show(message,action,label){notice.replaceChildren();const text=document.createElement('p');text.textContent=message;notice.append(text);if(action){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.onclick=action;notice.append(b);}}
 function close(){dialog.close();dialog.replaceChildren();}
 function modal(body){dialog.innerHTML=body;dialog.querySelector('[data-close]')?.addEventListener('click',close);if(!dialog.open)dialog.showModal();}
 function info(text){show(text);api.status(ready?'À vérifier':'Local · migration requise','');}
 function errorText(e){const m=e?.message||String(e);return m.includes('VERSION_CONFLICT')?'Une autre modification a été confirmée. Comparez les versions avant de continuer.':m.includes('ADMIN_REQUIRED')?'La migration doit être effectuée par un administrateur autorisé.':m.includes('BRIDGE_AUTH_REQUIRED')?'Ce compte doit avoir une adresse confirmée et être autorisé par l’administrateur.':m;}
 async function call(op){const {data,error}=await client.rpc('dipsy_bridge_operation',{op}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;return data;}
 async function snapshot(){const {data,error}=await client.rpc('dipsy_tables_snapshot').abortSignal(AbortSignal.timeout(15000));if(error)throw error;if(!data)throw Error('BRIDGE_AUTH_REQUIRED');return data;}
 function install(value){suppress=true;try{api.apply(structuredClone(value));}finally{suppress=false;}}
 function remember(){localStorage.setItem(baseKey(),JSON.stringify({version:revision,payload:baseline}));}
 function login(){
  modal(`<form id="bridgeLogin"><h2>Connexion sécurisée</h2><p>Utilisez votre compte autorisé Dipsy. Le profil Steven/Naty sert au service et ne remplace pas cette connexion.</p><div class="field"><label for="bridgeEmail">Adresse e-mail</label><input id="bridgeEmail" type="email" autocomplete="email" required></div><div class="field"><label for="bridgePassword">Mot de passe</label><input id="bridgePassword" type="password" autocomplete="current-password" required></div><label class="bridge-check"><input id="bridgeSignup" type="checkbox"> Première connexion : créer mon accès</label><p id="bridgeAuthError" role="alert"></p><div class="actions"><button type="button" class="btn" data-close>Fermer</button><button class="btn primary">Se connecter</button></div></form>`);
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=dialog.querySelector('button.primary'),msg=dialog.querySelector('#bridgeAuthError');b.disabled=true;try{const email=dialog.querySelector('#bridgeEmail').value.trim(),password=dialog.querySelector('#bridgePassword').value;if(dialog.querySelector('#bridgeSignup').checked){if(password.length<12)throw Error('Choisissez un mot de passe de 12 caractères minimum.');const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:CAISSE}});if(error)throw error;msg.textContent='Confirmez votre adresse avec le lien reçu, puis connectez-vous ici.';}else{const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;close();}}catch(e){msg.textContent=errorText(e);}finally{if(b.isConnected)b.disabled=false;}};
 }
 const backupButton=document.createElement('button');backupButton.type='button';backupButton.className='btn';backupButton.textContent='Copie de secours';backupButton.onclick=downloadBackup;document.querySelector('.top-actions').append(backupButton);
 authButton.onclick=()=>session?account():login();
 function account(){modal(`<h2>Votre accès Dipsy</h2><p>${esc(session.user.email)}</p><p>Les réservations partagées sont réservées aux comptes autorisés.</p><div class="actions"><button class="btn" data-close>Fermer</button><button class="btn" id="bridgeLogout">Se déconnecter</button></div>`);dialog.querySelector('#bridgeLogout').onclick=async()=>{await flush();if(pending||busy||remoteConflict){info('Confirmez les opérations en attente avant de vous déconnecter.');return;}await client.auth.signOut();close();};}
 function backup(){const key='dipsy-before-reservation-bridge-v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({at:new Date().toISOString(),snapshot:api.capture(),raw:api.rawBackup?.()}));return JSON.parse(localStorage.getItem(key));}
 function downloadBackup(){const blob=new Blob([JSON.stringify(backup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dipsy-tables-avant-passerelle.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function review(migration=false){
  if(!session){login();return;}if(pending&&!remoteConflict){info('Une confirmation serveur est encore attendue. La même opération sera réessayée.');return;}
  try{
   backup();const local=await prepareLegacy(api.capture()),server=await snapshot(),base=migration?{data:{},history:{},tableSettings:{}}:baseline||{data:{}};let choices={};
   function draw(){const plan=mergePlan(local,server.payload,base,choices,server.tombstones||[]);modal(`<form id="bridgeReview"><h2>${migration?'Migrer cet appareil':'Résoudre les différences'}</h2><p>${records(local).size} réservations sur cet appareil ; ${records(server.payload).size} sur le serveur. Les identifiants existants sont conservés. La copie locale d’origine et l’historique restent sauvegardés.</p><button type="button" class="btn" id="bridgeBackup">Télécharger la copie de secours</button>${plan.conflicts.map(c=>`<section class="bridge-conflict"><h3>${c.id==='settings'?'Réglages des tables':'Même identifiant : '+esc(c.id)}</h3><div><strong>Cet appareil</strong><pre>${esc(JSON.stringify(c.local??'Supprimée',null,2))}</pre></div><div><strong>Serveur</strong><pre>${esc(JSON.stringify(c.remote??'Supprimée',null,2))}</pre></div><label>Version à conserver<select data-choice="${esc(c.id)}"><option value="">Choisir explicitement</option value="local">Cet appareil</option><option value="remote">Serveur</option></select></label></section>`).join('')}<p id="bridgeReviewError" role="alert"></p><div class="actions"><button type="button" class="btn" data-close>Revenir aux réservations</button><button class="btn primary" ${plan.conflicts.length?'disabled':''}>${migration?'Confirmer la migration':'Confirmer la fusion'}</button></div></form>`);dialog.querySelector('#bridgeBackup').onclick=downloadBackup;dialog.querySelectorAll('[data-choice]').forEach(select=>select.onchange=()=>{choices[select.dataset.choice]=select.value;dialog.querySelector('button.primary').disabled=mergePlan(local,server.payload,base,choices,server.tombstones||[]).conflicts.length>0;});dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=dialog.querySelector('button.primary');button.disabled=true;try{const resolved=mergePlan(local,server.payload,base,choices,server.tombstones||[]);if(resolved.conflicts.length)throw Error('Choisissez chaque version à conserver.');const payload=api.decorate(resolved.payload);if(remoteConflict){localStorage.setItem(`dipsy-conflict-backup-${Date.now()}`,JSON.stringify({local,server}));pending=null;localStorage.removeItem(queueKey());remoteConflict=null;}
    const op={id:crypto.randomUUID(),kind:migration?'import':'save',baseVersion:server.version,payload:migration?{snapshot:local,merged:payload,revive_ids:(server.tombstones||[]).filter(t=>choices[t.reservation_id]==='local').map(t=>t.reservation_id)}:{state:payload}};pending=op;localStorage.setItem(queueKey(),JSON.stringify(op));install(payload);await send();if(pending)throw Error('Confirmation en attente. Gardez cet appareil connecté.');close();
   }catch(e){dialog.querySelector('#bridgeReviewError').textContent=errorText(e);if(button.isConnected)button.disabled=false;}};}
   draw();
  }catch(e){info(errorText(e));}
 }
 async function importFree(){
  backup();const local=await prepareLegacy(api.capture()),remote=await snapshot();
  const plan=mergePlan(local,remote.payload,{data:{},history:{},tableSettings:{}},{},remote.tombstones||[]);
  if(plan.conflicts.length){show('Des versions différentes existent sur cet appareil et le serveur. Votre copie reste conservée.',()=>void review(true),'Comparer les réservations');return;}
  const payload=api.decorate(plan.payload);pending={id:crypto.randomUUID(),kind:'import',baseVersion:remote.version,payload:{snapshot:local,merged:payload}};
  localStorage.setItem(queueKey(),JSON.stringify(pending));install(payload);await send();
 }
 async function signedIn(value){
  const {data:free,error:freeError}=navigator.onLine?await freeClient.rpc('dipsy_bridge_public_access').abortSignal(AbortSignal.timeout(10000)):{data:null,error:true};
  if(!freeError)localStorage.setItem('dipsy-tables-free-enabled',String(free===true));
  freeAccess=freeError?localStorage.getItem('dipsy-tables-free-enabled')==='true':free===true;client=freeAccess?freeClient:authClient;
  if(freeAccess)value={user:{id:'public-shared'}};
  authButton.hidden=freeAccess;
  session=value;ready=false;baseline=null;revision=0;pending=null;remoteConflict=null;role=null;caisseTools.reset();channel?.unsubscribe();channel=null;authButton.textContent=value?'Mon accès Dipsy':'Connexion sécurisée';
  if(!value){show('Réservations conservées sur cet appareil. Connectez-vous pour préparer la migration et activer la passerelle.',login,'Connexion sécurisée');api.status('Local · migration requise','');return;}
  try{const {data:member,error}=freeAccess?{data:'admin',error:null}:await client.rpc('caisse_my_role');if(error)throw error;if(!member)throw Error('BRIDGE_AUTH_REQUIRED');role=member;caisseTools.reset();pending=JSON.parse(localStorage.getItem(queueKey())||'null');const oldBase=JSON.parse(localStorage.getItem(baseKey())||'null');if(oldBase){baseline=oldBase.payload;revision=oldBase.version;}
   if(localStorage.getItem(marker())&&oldBase){ready=true;if(pending)await send();if(navigator.onLine)await pull();if(!remoteConflict)await flush();if(!navigator.onLine)api.status('Hors ligne · copie locale','');if(!pending&&!remoteConflict)show('Cet appareil a été migré. Les réservations confirmées sont partagées avec la caisse.');}else if(pending){await send();if(!pending)await pull();}else if(freeAccess)await importFree();else show('Cet appareil n’a pas encore été migré. Vérifiez la copie de secours et les identifiants avant d’activer CAISSE.',()=>void review(true),'Préparer la migration');
   await caisseTools.send();await caisseTools.refresh();
   channel=client.channel('dipsy-tables-bridge').on('postgres_changes',{event:'UPDATE',schema:'public',table:'dipsy_tables_state'},()=>void pull()).on('postgres_changes',{event:'*',schema:'public',table:'caisse_orders'},()=>void caisseTools.refresh()).on('postgres_changes',{event:'*',schema:'public',table:'caisse_payments'},()=>void caisseTools.refresh()).on('postgres_changes',{event:'*',schema:'public',table:'caisse_order_lines'},()=>void caisseTools.refresh()).subscribe();
  }catch(e){info(errorText(e));}
 }
 async function send(){
  if(busy||!session||!pending||!navigator.onLine||remoteConflict)return;busy=true;api.status('Confirmation…','syncing');const op=pending;
  try{const result=await call(op);const sent=op.kind==='import'?op.payload.merged:op.payload.state;baseline=structuredClone(sent);revision=result.version;remember();ready=true;localStorage.setItem(marker(),result.import_id||'confirmed');localStorage.removeItem(queueKey());pending=null;caisseTools.publish();api.status('En ligne · partagé','online');show('Réservations confirmées et partagées. Le bouton CAISSE ouvre la réservation par son identifiant.');}
  catch(e){if(e.code==='P0001'&&e.message.includes('VERSION_CONFLICT')){remoteConflict=e;show('Une autre version a été enregistrée. Votre copie est conservée ; comparez les différences.',()=>void review(op.kind==='import'),'Résoudre les différences');}else info(errorText(e)+' · Opération conservée, confirmation serveur attendue.');}
  finally{busy=false;}
 }
 function scheduleSave(){if(suppress||!ready||!session)return;const current=api.capture();for(const rows of Object.values(current.data||{}))for(const b of rows)b.reservation_id=b.id;if(stable(current)===stable(baseline))return;api.status('Modifications non confirmées','syncing');clearTimeout(timer);timer=setTimeout(()=>void flush(),500);}
 async function flush(){
  if(!ready||!session||busy||remoteConflict)return;if(pending){await send();if(pending)return;}
  const next=await prepareLegacy(api.capture());if(stable(next)===stable(baseline))return;
  pending={id:crypto.randomUUID(),kind:'save',baseVersion:revision,payload:{state:next}};localStorage.setItem(queueKey(),JSON.stringify(pending));await send();
 }
 async function pull(){
  if(!ready||!session||busy||remoteConflict||pending)return;
  try{const remote=await snapshot();if(remote.version<revision){remoteConflict={message:'VERSION_CONFLICT'};show('La version du serveur est antérieure à la copie confirmée de cet appareil. Votre copie est conservée.',()=>void review(true),'Vérifier la restauration');return;}if(remote.version===revision){api.status('En ligne · partagé','online');return;}const current=await prepareLegacy(api.capture());if(baseline&&stable(current)!==stable(baseline)){remoteConflict={message:'VERSION_CONFLICT'};show('Une correction a été reçue pendant votre saisie. Votre saisie reste conservée.',()=>void review(false),'Comparer les versions');return;}baseline=structuredClone(remote.payload);revision=remote.version;remember();install(remote.payload);api.status('En ligne · partagé','online');}
  catch(e){info(errorText(e));}
 }
 async function openReservation(id){
  if(!session){login();return;}if(!ready){void review(true);return;}
  const current=api.capture();for(const rows of Object.values(current.data||{}))for(const b of rows)b.reservation_id=b.id;
  if(pending||busy||remoteConflict||stable(current)!==stable(baseline)){
   show('La réservation attend sa confirmation. Synchronisez avant de l’ouvrir dans la caisse.',()=>void flush().then(()=>{if(!pending&&!remoteConflict&&!busy)show('Réservation confirmée. Vous pouvez maintenant ouvrir la caisse.',()=>void openReservation(id),'Ouvrir la caisse');}),'Vérifier et synchroniser');return;
  }
  if(!UUID.test(id)||!records(current).has(id)){info('Identifiant de réservation introuvable.');return;}
  const url=new URL(CAISSE);url.searchParams.set('reservation_id',id);
  const popup=window.open(url.href,'_blank');
  if(!popup){location.href=url.href;return;}
  if(freeAccess){show('La caisse s’ouvre directement sur cette réservation.');return;}
  const handoff=async event=>{if(event.origin!==CAISSE_ORIGIN||event.source!==popup||event.data?.type!=='DIPSY_CAISSE_AUTH_REQUEST'||event.data?.reservation_id!==id||typeof event.data?.nonce!=='string'||!UUID.test(event.data.nonce))return;const {data:{session:currentSession}}=await client.auth.getSession();if(!currentSession)return;popup.postMessage({type:'DIPSY_TABLES_AUTH',nonce:event.data.nonce,reservation_id:id,access_token:currentSession.access_token,refresh_token:currentSession.refresh_token},CAISSE_ORIGIN);window.removeEventListener('message',handoff);};
  window.addEventListener('message',handoff);setTimeout(()=>window.removeEventListener('message',handoff),30000);
  show('La caisse s’ouvre sur cette réservation. Si votre navigateur bloque le nouvel onglet, utilisez le lien ci-dessous.');const link=document.createElement('a');link.href=url.href;link.className='btn';link.textContent='Ouvrir cette réservation dans la caisse';notice.append(link);
 }
 authClient.auth.onAuthStateChange((event,value)=>{if(event==='TOKEN_REFRESHED'){if(!freeAccess)session=value;return;}setTimeout(()=>void signedIn(value),0);});
 window.addEventListener('online',()=>{if(!ready){void signedIn(session);return;}void flush().then(pull).then(()=>caisseTools.send()).then(()=>caisseTools.refresh());});window.addEventListener('offline',()=>{caisseTools.invalidate();api.status('Hors ligne · copie locale','');});
 window.addEventListener('beforeunload',e=>{if(pending){e.preventDefault();}});setInterval(()=>{if(ready&&navigator.onLine)void flush().then(pull).then(()=>caisseTools.send()).then(()=>caisseTools.refresh());},10000);
 show('Les réservations locales sont conservées. La passerelle nécessite une connexion et la migration de cet appareil.',login,'Connexion sécurisée');api.status('Local · migration requise','');
 return {scheduleSave,openReservation,openArticles:id=>caisseTools.reservation(id)};
}

export {paymentDisplay} from './payment-state.mjs';
