import {reservationPayments,paymentDisplay,money,cents} from './payment-state.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=n=>(n/100).toFixed(2).replace('.',',');
export function createCaisseTools({client,access,openReservation,onPayments}){
 let snapshot=null,confirmed=false,loading=false,generation=0,pending=null,sending=false,ack=null;
 const key=()=>`dipsy-tables-financial-outbox-${access().session?.user.id}`;
 const dialog=document.createElement('dialog');dialog.className='table-dialog bridge-dialog';dialog.setAttribute('aria-label','Articles et prix');document.body.append(dialog);
 const button=document.createElement('button');button.className='btn';button.type='button';button.textContent='Articles & prix';button.onclick=()=>void catalog();document.querySelector('.top-actions').append(button);
 const note=document.createElement('section');note.className='panel bridge-notice';note.hidden=true;note.setAttribute('aria-live','polite');document.querySelector('header').after(note);
 function message(text){note.hidden=false;note.replaceChildren();const p=document.createElement('p');p.textContent=text;note.append(p);if(pending){const retry=document.createElement('button');retry.className='btn';retry.textContent='Vérifier la confirmation';retry.onclick=()=>void send();note.append(retry);}}
 function publish(){onPayments(reservationPayments(snapshot||{}),confirmed&&access().ready&&!!access().session);}
 function invalidate(){confirmed=false;publish();}
 function reset(){generation++;snapshot=null;invalidate();pending=null;ack=null;note.hidden=true;dialog.close();const user=access().session?.user.id;if(user)try{pending=JSON.parse(localStorage.getItem(key())||'null');}catch{message('La correction locale est illisible. Conservez la copie de cet appareil.');}if(pending)message('Une correction attend encore sa confirmation serveur.');}
 async function refresh(){
  if(!access().session||!access().role||!navigator.onLine){invalidate();return false;}if(loading)return false;loading=true;const gen=generation;
  try{const {data,error}=await client.rpc('caisse_snapshot').abortSignal(AbortSignal.timeout(15000));if(error)throw error;if(gen!==generation)return false;snapshot=data;confirmed=true;publish();return true;}catch{invalidate();return false;}finally{loading=false;}
 }
 function modal(body){dialog.innerHTML=body;dialog.querySelector('[data-close]')?.addEventListener('click',()=>dialog.close());if(!dialog.open)dialog.showModal();}
 function closeButton(){return '<button type="button" class="btn" data-close>Fermer</button>';}
 function problem(text){modal(`<h2>Articles & prix</h2><p role="alert">${esc(text)}</p>${closeButton()}`);}
 function writable(){return access().role==='admin'&&!pending;}
 async function load(){if(!access().session||!access().role){problem('Connectez-vous avec un compte autorisé via « Connexion sécurisée ».');return false;}if(!await refresh()){problem('Connexion au serveur nécessaire pour afficher et corriger les articles.');return false;}return true;}
 async function send(){
  if(sending||!pending||!access().session)return;if(!navigator.onLine){message('Hors ligne : correction conservée sur cet appareil, non confirmée.');return;}
  sending=true;const op=pending,gen=generation;message('Correction en attente de confirmation serveur…');
  try{const {error}=await client.rpc('caisse_apply_operation',{op}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;if(gen!==generation)return;
   localStorage.removeItem(key());pending=null;message('Correction confirmée par le serveur · historique conservé.');await refresh();const callback=ack;ack=null;callback?.();
  }catch(e){if(gen!==generation)return;
   // A definite SQL rejection means nothing was committed. Preserve the attempted values.
   if(['P0001','42501','23514','22P02','23505','23503'].includes(e.code)){
    localStorage.setItem(key()+'-rejected',JSON.stringify({op,error:e.message,at:new Date().toISOString()}));localStorage.removeItem(key());pending=null;ack=null;
    const text=e.message.includes('VERSION_CONFLICT')?'Une autre modification a été confirmée. Fermez puis rouvrez pour comparer ; votre saisie refusée reste sauvegardée.':e.message.includes('ORDER_HAS_PAYMENTS')||e.message.includes('ORDER_LOCKED')?'Cette commande a déjà un règlement ou est clôturée. Les articles sont conservés.':e.message.includes('ADMIN_REQUIRED')?'Correction réservée à l’administrateur.':e.message;
    message(text);const err=dialog.querySelector('[role=alert]');if(err)err.textContent=text;dialog.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=false);
   }else message('Confirmation indisponible. La correction reste conservée ; nouvelle vérification automatique avec le même identifiant.');
  }finally{sending=false;}
 }
 async function submit(op,callback){if(pending||sending)return;pending=op;ack=callback;localStorage.setItem(key(),JSON.stringify(op));dialog.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=true);await send();}
 async function catalog(){if(!await load())return;
  modal(`<h2>Articles & prix</h2><p>La carte est partagée avec Dipsy Caisse. Les modifications concernent les prochains ajouts ; les tickets existants conservent leurs prix.</p>${pending?'<p>Une correction attend sa confirmation. Les modifications sont temporairement bloquées.</p>':''}<div class="caisse-item-list">${snapshot.products.map(p=>`<section class="caisse-item"><div><strong>${esc(p.name)}</strong><small>${p.reference?`Réf. ${esc(p.reference)} · `:''}${money(p.price_cents)} TTC · TVA ${p.vat_bps/100} % · ${p.active?'Actif':'Archivé'}</small></div><button class="btn" data-product="${p.id}" ${writable()?'':'disabled'}>Modifier</button></section>`).join('')}</div>${access().role!=='admin'?'<p>Les prix se modifient avec un accès administrateur.</p>':''}<div class="actions">${closeButton()}</div>`);
  dialog.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>editProduct(snapshot.products.find(p=>p.id===b.dataset.product)));
 }
 function editProduct(p){
  const options=(values,selected)=>values.map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('');
  modal(`<form id="caisseProduct"><h2>Modifier la fiche article</h2><label>Nom de l’article<input name="name" value="${esc(p.name)}" maxlength="120" required></label><label>Référence<input name="reference" value="${esc(p.reference||'')}" maxlength="80" placeholder="Facultative"></label><div class="caisse-form-grid"><label>Prix unitaire TTC (€)<input name="price" value="${amount(p.price_cents)}" inputmode="decimal" required></label><label>Taux de TVA (%)<input name="vat" value="${amount(p.vat_bps)}" inputmode="decimal" required></label></div><label>Catégorie<select name="category">${options([['entrees','Entrées'],['plats','Plats'],['desserts','Desserts'],['boissons','Boissons'],['alcool','Alcool']],p.category)}</select></label><label>Groupe comptable<select name="group">${options([['food','Nourriture'],['non_alcohol','Boissons sans alcool'],['alcohol','Alcool']],p.accounting_group)}</select></label><label class="bridge-check"><input type="checkbox" name="active" ${p.active?'checked':''}> Disponible à la vente</label><p>La TVA se choisit par produit. Les tickets existants conservent leurs montants. Pour les corriger avant règlement, ouvrez « ARTICLES » sur la réservation.</p><p role="alert"></p><div class="actions"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="submit">Confirmer la modification</button></div></form>`);
  const form=dialog.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const price=cents(form.elements.price.value),vat=cents(form.elements.vat.value),name=form.elements.name.value.trim();if(!name||!Number.isInteger(price)||price<1||price>1000000||!Number.isInteger(vat)||vat<0||vat>10000){form.querySelector('[role=alert]').textContent='Vérifiez le nom, le prix et le taux de TVA (0 à 100 %). Deux décimales maximum.';return;}
   await submit({id:crypto.randomUUID(),kind:'save_product',entityId:p.id,baseVersion:p.version,payload:{name,reference:form.elements.reference.value.trim(),price_cents:price,category:form.elements.category.value,vat_bps:vat,accounting_group:form.elements.group.value,active:form.elements.active.checked}},()=>void catalog());};
 }
 async function reservation(id){if(!await load())return;if(!access().ready){problem('Confirmez la migration de cet appareil pour relier les articles à la réservation.');return;}
  const order=snapshot.orders.find(o=>o.reservation_id===id),lines=snapshot.lines.filter(l=>l.order_id===order?.id),paid=snapshot.payments.some(p=>p.order_id===order?.id),canEdit=!!order&&writable()&&!paid&&!['paid','cancelled'].includes(order.status);
  const display=paymentDisplay(reservationPayments(snapshot)[id],confirmed);
  modal(`<h2>Articles de la réservation</h2><p class="payment-label ${display.className}">${esc(display.label)}</p>${order?`<p>Commande #${order.number} · total ${money(lines.reduce((n,l)=>n+l.total_cents,0))}</p>`:'<p>Aucune commande caisse pour cette réservation.</p>'}<div class="caisse-item-list">${lines.map(l=>`<section class="caisse-item"><div><strong>${esc(l.name)}</strong><small>${l.quantity} × ${money(l.unit_price_cents)} = ${money(l.total_cents)}</small></div><button class="btn" data-line="${l.id}" ${canEdit?'':'disabled'}>Corriger</button></section>`).join('')}</div><p>${paid||order&&['paid','cancelled'].includes(order.status)?'Un règlement ou une clôture protège les articles et leur historique.':access().role!=='admin'?'Corrections réservées à l’administrateur.':'Avant le premier règlement, corrigez le prix, la quantité ou l’article. Le prix de la carte reste conservé.'}</p><div class="actions">${closeButton()}<button type="button" class="btn caisse" id="goCaisse">Ouvrir la caisse</button></div>`);
  dialog.querySelector('#goCaisse').onclick=()=>{dialog.close();void openReservation(id);};
  dialog.querySelectorAll('[data-line]').forEach(b=>b.onclick=()=>editLine(order,lines.find(l=>l.id===b.dataset.line),id));
 }
 function editLine(order,line,id){
  modal(`<form id="caisseLine"><h2>Corriger l’article</h2><label>Référence / article<select name="product">${snapshot.products.filter(p=>p.active||p.id===line.product_id).map(p=>`<option value="${p.id}" ${p.id===line.product_id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>Nom sur le ticket<input name="name" value="${esc(line.name)}" maxlength="120" required></label><div class="caisse-form-grid"><label>Prix unitaire TTC (€)<input name="price" value="${amount(line.unit_price_cents)}" inputmode="decimal" required></label><label>Quantité<input name="quantity" value="${line.quantity}" type="number" inputmode="numeric" min="1" max="999" required></label></div><p>L’ancien et le nouveau montant restent dans l’historique. Un changement d’article reprend sa TVA et son groupe comptable.</p><p role="alert"></p><div class="actions"><button type="button" class="btn" data-close>Annuler</button><button type="submit" class="btn primary">Confirmer la correction</button></div></form>`);
  const form=dialog.querySelector('form');form.elements.product.onchange=()=>{const p=snapshot.products.find(p=>p.id===form.elements.product.value);form.elements.name.value=p.name;form.elements.price.value=amount(p.price_cents);};
  form.onsubmit=async e=>{e.preventDefault();const price=cents(form.elements.price.value),quantity=Number(form.elements.quantity.value),name=form.elements.name.value.trim();if(!name||!Number.isInteger(price)||price<1||price>1000000||!Number.isInteger(quantity)||quantity<1||quantity>999){form.querySelector('[role=alert]').textContent='Vérifiez le nom, le prix et la quantité.';return;}
   await submit({id:crypto.randomUUID(),kind:'correct_line',entityId:order.id,baseVersion:order.version,payload:{line_id:line.id,product_id:form.elements.product.value,name,unit_price_cents:price,quantity}},()=>void reservation(id));};
 }
 return {reset,refresh,invalidate,reservation,send,publish};
}
