// Money comes only from a confirmed caisse_snapshot, indexed by reservation UUID.
export const money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n/100);
export function reservationPayments(snapshot){
 const result={};const totals=new Map(),paid=new Map();
 for(const line of snapshot.lines||[])totals.set(line.order_id,(totals.get(line.order_id)||0)+line.total_cents);
 for(const payment of snapshot.payments||[])paid.set(payment.order_id,(paid.get(payment.order_id)||0)+payment.amount_cents);
 for(const order of snapshot.orders||[]){if(!order.reservation_id)continue;const total=totals.get(order.id)||0,received=paid.get(order.id)||0;
 result[order.reservation_id]={order_id:order.id,status:order.status,total,paid:received,remaining:total-received};}
 return result;
}
export function paymentDisplay(state,confirmed){
 if(!confirmed)return {className:'payment-unknown',label:'Paiement à vérifier'};
 if(!state)return {className:'payment-unpaid',label:'Non réglée · aucune commande'};
 if(state.status==='cancelled')return {className:'payment-unknown',label:'Commande annulée'};
 if(state.status==='paid'&&state.total>0&&state.remaining===0)return {className:'payment-paid',label:`Réglée · ${money(state.paid)}`};
 return {className:'payment-unpaid',label:state.paid>0?`Partiel · reste ${money(Math.max(0,state.remaining))}`:state.total>0?`Non réglée · ${money(state.remaining)}`:'Non réglée · commande vide'};
}
export function cents(value){const text=String(value).trim().replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(text))return NaN;const [whole,fraction='']=text.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));}
