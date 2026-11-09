import { authenticatedProfile } from '@/lib/supabase';
import { createHash, randomBytes } from 'node:crypto';

const LINK_KEY='sales-appointments-v1';
const normalize=(value:any)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const levelAllowed=(level:any)=>['analysis','capture','full'].includes(level);
const levelCapture=(level:any)=>['capture','full'].includes(level);

function moduleLevel(profile:any){
  if(profile?.role==='admin')return'full';
  const entry=profile?.permissions?.moduleAccess?.citas;
  if(!entry)return profile?.permissions?.views?.includes('citas')?'analysis':'none';
  if(entry.level&&entry.level!=='mixed')return entry.level;
  const levels=Object.values(entry.submodules||{});
  if(levels.includes('full'))return'full';if(levels.includes('capture'))return'capture';if(levels.includes('analysis'))return'analysis';return'none';
}

async function allowedBranches(admin:any,profile:any):Promise<Set<string>|null>{
  if(profile.role==='admin')return null;
  const explicit=[...(Array.isArray(profile.branches)?profile.branches:[]),profile.branch].filter(Boolean);
  if(explicit.length)return new Set<string>(explicit.map(normalize));
  const brands=new Set<string>((Array.isArray(profile.brands)?profile.brands:[]).map(normalize));
  if(!brands.size)return new Set<string>();
  const {data}=await admin.from('funnel_storage').select('value').eq('storage_key','funnel-kpi-v2-branches').eq('scope','shared').is('owner_id',null).maybeSingle();
  const rows=Array.isArray(data?.value)?data.value:typeof data?.value==='string'?JSON.parse(data.value||'[]'):[];
  return new Set<string>(rows.filter((row:any)=>row?.active!==false&&brands.has(normalize(row?.brand))).map((row:any)=>normalize(row?.name)));
}

const inScope=(row:any,branches:Set<string>|null,profile:any)=>branches===null||(branches.has(normalize(row?.branch))&&(!profile.manager||normalize(row?.manager)===normalize(profile.manager)));
const json=(body:any,status=200)=>Response.json(body,{status});

export async function GET(request:Request){
  const auth=await authenticatedProfile(request);if(!auth)return json({error:'Sesión no autorizada'},401);
  const level=moduleLevel(auth.profile);if(!levelAllowed(level))return json({error:'Sin acceso al módulo Citas APV'},403);
  const url=new URL(request.url),from=url.searchParams.get('from')||new Date(Date.now()-31*86400000).toISOString(),to=url.searchParams.get('to')||new Date(Date.now()+62*86400000).toISOString();
  let query=auth.admin.from('funnel_sales_appointments').select('*').gte('appointment_at',from).lte('appointment_at',to).order('appointment_at',{ascending:true}).limit(5000);
  const {data,error}=await query;if(error)return json({error:`No fue posible consultar citas: ${error.message}`},500);
  const branches=await allowedBranches(auth.admin,auth.profile),appointments=(data||[]).filter((row:any)=>inScope(row,branches,auth.profile));
  const {data:link}=await auth.admin.from('funnel_public_links').select('active,expires_at,updated_at').eq('link_key',LINK_KEY).maybeSingle();
  return json({appointments,linkActive:Boolean(link?.active&&(!link.expires_at||new Date(link.expires_at)>new Date())),linkUpdatedAt:link?.updated_at||null});
}

export async function POST(request:Request){
  const auth=await authenticatedProfile(request);if(!auth)return json({error:'Sesión no autorizada'},401);
  if(moduleLevel(auth.profile)!=='full')return json({error:'Se requiere Control total para administrar el enlace'},403);
  const body=await request.json().catch(()=>({}));if(body.action!=='generate-link')return json({error:'Acción inválida'},400);
  const token=randomBytes(32).toString('base64url'),tokenHash=createHash('sha256').update(token).digest('hex'),expiresAt=new Date(Date.now()+365*86400000).toISOString();
  const {error}=await auth.admin.from('funnel_public_links').upsert({link_key:LINK_KEY,token_hash:tokenHash,active:true,expires_at:expiresAt,updated_by:auth.user.id,updated_at:new Date().toISOString()},{onConflict:'link_key'});
  if(error)return json({error:`No fue posible generar el enlace: ${error.message}`},500);
  const origin=new URL(request.url).origin;return json({url:`${origin}/citas?token=${encodeURIComponent(token)}`,expiresAt});
}

export async function PATCH(request:Request){
  const auth=await authenticatedProfile(request);if(!auth)return json({error:'Sesión no autorizada'},401);
  const level=moduleLevel(auth.profile);if(!levelCapture(level))return json({error:'Se requiere permiso de Captura'},403);
  const body=await request.json().catch(()=>({})),id=String(body.id||''),status=String(body.status||'');
  if(!id||!['scheduled','attended','no_show','cancelled'].includes(status))return json({error:'Actualización inválida'},400);
  const {data:current,error:readError}=await auth.admin.from('funnel_sales_appointments').select('*').eq('id',id).maybeSingle();if(readError||!current)return json({error:'Cita no encontrada'},404);
  const branches=await allowedBranches(auth.admin,auth.profile);if(!inScope(current,branches,auth.profile))return json({error:'La cita está fuera de tu alcance'},403);
  const patch:any={status,updated_at:new Date().toISOString(),confirmed_by:auth.user.id};if(status==='attended')patch.attended_at=new Date().toISOString();else patch.attended_at=null;
  const {data,error}=await auth.admin.from('funnel_sales_appointments').update(patch).eq('id',id).select('*').single();if(error)return json({error:error.message},500);
  await auth.admin.from('funnel_audit_log').insert({user_id:auth.user.id,action:'SALES_APPOINTMENT_STATUS',storage_key:'funnel_sales_appointments',detail:{id,status}});
  return json({appointment:data});
}

export async function DELETE(request:Request){
  const auth=await authenticatedProfile(request);if(!auth)return json({error:'Sesión no autorizada'},401);
  if(moduleLevel(auth.profile)!=='full')return json({error:'Se requiere Control total'},403);
  const {error}=await auth.admin.from('funnel_public_links').update({active:false,updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq('link_key',LINK_KEY);if(error)return json({error:error.message},500);
  return json({ok:true});
}
