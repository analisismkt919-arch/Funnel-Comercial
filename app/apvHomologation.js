const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toUpperCase();

const BRANCH_FIELDS=['branch','sucursal','agency','agencia'];
const APV_FIELDS=['vendor','apv','salesperson','vendedor','asesor'];

export const findApvAlias=(name,branch,aliases=[])=>{
  const personKey=normalize(name),branchKey=normalize(branch);
  if(!personKey||!branchKey)return null;
  return aliases.find(row=>normalize(row?.branch)===branchKey&&normalize(row?.sourceName)===personKey)||null;
};

export const homologateApvRecord=(record,aliases=[],inheritedBranch='')=>{
  if(!record||typeof record!=='object'||Array.isArray(record))return record;
  const branch=BRANCH_FIELDS.map(field=>record[field]).find(value=>String(value??'').trim())||inheritedBranch;
  let changed=false;
  const next={...record};
  APV_FIELDS.forEach(field=>{
    const current=record[field];
    if(!String(current??'').trim())return;
    const original=record[`${field}Original`]||current;
    const match=findApvAlias(original,branch,aliases);
    if(!match||normalize(current)===normalize(match.targetName))return;
    next[`${field}Original`]=original;
    next[field]=match.targetName;
    next.apvAliasId=match.id;
    changed=true;
  });
  return changed?next:record;
};

export const homologateApvData=(value,aliases=[],inheritedBranch='')=>{
  if(!aliases.length||value==null)return value;
  if(Array.isArray(value))return value.map(item=>homologateApvData(item,aliases,inheritedBranch));
  if(typeof value!=='object')return value;
  const ownBranch=BRANCH_FIELDS.map(field=>value[field]).find(item=>String(item??'').trim())||inheritedBranch;
  const normalized=homologateApvRecord(value,aliases,ownBranch);
  let changed=normalized!==value;
  const next={...normalized};
  Object.entries(normalized).forEach(([key,item])=>{
    if(!item||typeof item!=='object'||key==='auditTrail')return;
    const child=homologateApvData(item,aliases,ownBranch);
    if(child!==item){next[key]=child;changed=true;}
  });
  return changed?next:value;
};

