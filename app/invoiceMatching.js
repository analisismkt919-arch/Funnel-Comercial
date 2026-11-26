export const normalizeInvoice=value=>String(value??'').trim().toUpperCase().replace(/\s+/g,'');
const normalizeBranch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();

// Solo vincula un folio no vacío dentro de la misma sucursal si es inequívoco.
export function matchInvoice(invoice,branch,rows=[]){
 const key=normalizeInvoice(invoice),agency=normalizeBranch(branch);
 if(!key||!agency)return {status:'missing',matches:[]};
 const matches=rows.filter(row=>normalizeBranch(row.branch||row.sucursal)===agency&&normalizeBranch(row.status)!=='CANCELADA'&&normalizeInvoice(row.invoiceNumber)===key);
 return {status:matches.length===1?'matched':matches.length?'ambiguous':'not_found',matches};
}
