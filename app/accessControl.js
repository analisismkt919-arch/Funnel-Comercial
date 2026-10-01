export const ACCESS_LEVELS=[
  {key:'none',label:'Sin acceso',help:'No puede abrir esta sección.'},
  {key:'analysis',label:'Análisis',help:'Consulta indicadores, históricos y resultados.'},
  {key:'capture',label:'Captura',help:'Registra y actualiza información operativa.'},
  {key:'full',label:'Control total',help:'Consulta, captura y administra la sección.'},
];

export const ACCESS_MODULES=[
  {key:'funnel',label:'Funnel comercial',icon:'funnel',submodules:[
    {key:'dashboard',label:'Resumen ejecutivo',view:'dashboard'},
    {key:'comparativos',label:'Pulso comercial',view:'comparativos'},
    {key:'funnel_requerido',label:'Funnel requerido',view:'funnel_requerido'},
    {key:'resumen',label:'Informe con IA',view:'resumen'},
  ]},
  {key:'operacion',label:'Operación comercial',icon:'operation',submodules:[
    {key:'capture',label:'Captura consolidada',view:'capture'},
    {key:'history',label:'Histórico',view:'history'},
    {key:'metas',label:'Metas',view:'metas'},
  ]},
  {key:'bdc',label:'BDC',icon:'bdc',view:'bdc',submodules:[
    {key:'resumen',label:'Resumen ejecutivo'},
    {key:'gestionleads',label:'Gestión de leads'},
    {key:'citas',label:'Citas agendadas'},
    {key:'seguimiento',label:'Seguimiento'},
    {key:'capturaapv',label:'Captura consolidada'},
    {key:'equipos',label:'Equipos'},
    {key:'campanas',label:'Campañas'},
    {key:'telemarketing',label:'Telemarketing'},
  ]},
  {key:'fi',label:'Resultados',icon:'results',view:'fi',submodules:[
    {key:'demos',label:'Demostraciones / pruebas de manejo'},
    {key:'solicitudes',label:'Solicitudes GM'},
    {key:'tomas',label:'Tomas'},
    {key:'avaluos',label:'Avalúos'},
    {key:'seguros',label:'Seguros'},
    {key:'entregas',label:'Entregas'},
    {key:'especiales',label:'Proyectos especiales'},
  ]},
  {key:'inventarios',label:'Inventarios',icon:'inventory',view:'inventarios',submodules:[
    {key:'general',label:'Inventario y análisis'},
  ]},
  {key:'marketing',label:'Marketing',icon:'marketing',view:'marketing',submodules:[
    {key:'planning',label:'Planeación por modelo'},
    {key:'strategies',label:'Estrategias'},
    {key:'campaigns',label:'Campañas propias'},
    {key:'competition',label:'Competencia'},
  ]},
  {key:'industria',label:'Industria',icon:'industry',view:'industria',submodules:[
    {key:'general',label:'Indicadores de industria'},
  ]},
  {key:'geointeligencia',label:'Geointeligencia',icon:'geo',view:'geointeligencia',submodules:[
    {key:'general',label:'Análisis geográfico'},
  ]},
  {key:'catalogos',label:'Catálogos',icon:'catalog',view:'catalogos',adminOnly:true,submodules:[
    {key:'sucursales',label:'Sucursales'},
    {key:'comercial',label:'Estructura comercial'},
    {key:'bdc',label:'Equipo BDC'},
  ]},
  {key:'admin',label:'Usuarios',icon:'users',view:'admin',adminOnly:true,submodules:[
    {key:'usuarios',label:'Gestión de usuarios'},
  ]},
];

export const normalizeAccessLevel=value=>ACCESS_LEVELS.some(level=>level.key===value)?value:'none';
export const levelCanAnalyze=level=>['analysis','full'].includes(normalizeAccessLevel(level));
export const levelCanCapture=level=>['capture','full'].includes(normalizeAccessLevel(level));
export const levelIsFull=level=>normalizeAccessLevel(level)==='full';

export function moduleDefinition(key){return ACCESS_MODULES.find(module=>module.key===key)||null;}
export function moduleForView(view){return ACCESS_MODULES.find(module=>module.view===view||module.submodules?.some(submodule=>submodule.view===view))||null;}

export function accessLevelFor(session,moduleKey,submoduleKey=null){
  if(session?.role==='admin')return'full';
  const module=moduleDefinition(moduleKey);
  if(!module)return'none';
  const matrix=session?.moduleAccess;
  if(matrix&&typeof matrix==='object'){
    const entry=matrix[moduleKey];
    if(submoduleKey&&entry?.submodules&&Object.prototype.hasOwnProperty.call(entry.submodules,submoduleKey))return normalizeAccessLevel(entry.submodules[submoduleKey]);
    if(entry?.level&&entry.level!=='mixed')return normalizeAccessLevel(entry.level);
    if(module.submodules?.length){
      const levels=module.submodules.map(submodule=>normalizeAccessLevel(entry?.submodules?.[submodule.key]));
      if(levels.includes('full'))return'full';
      if(levels.includes('capture'))return'capture';
      if(levels.includes('analysis'))return'analysis';
    }
    return'none';
  }
  const view=submoduleKey?module.submodules?.find(submodule=>submodule.key===submoduleKey)?.view:module.view;
  const legacyViews=session?.customViews||[];
  const allowed=!legacyViews.length||legacyViews.includes(view||module.view);
  if(!allowed)return'none';
  return session?.customCanCapture?'full':'analysis';
}

export function allowedViewsFromMatrix(session){
  if(!session?.moduleAccess||typeof session.moduleAccess!=='object')return null;
  const views=[];
  for(const module of ACCESS_MODULES){
    if(module.adminOnly&&session.role!=='admin')continue;
    if(module.view){
      const hasAccess=module.submodules?.some(submodule=>accessLevelFor(session,module.key,submodule.key)!=='none')||accessLevelFor(session,module.key)!=='none';
      if(hasAccess)views.push(module.view);
    }
    for(const submodule of module.submodules||[]){
      if(submodule.view&&accessLevelFor(session,module.key,submodule.key)!=='none')views.push(submodule.view);
    }
  }
  return[...new Set(views)];
}

export function matrixHasCapture(matrix={}){
  return Object.values(matrix||{}).some(entry=>levelCanCapture(entry?.level)||Object.values(entry?.submodules||{}).some(levelCanCapture));
}
