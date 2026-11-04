const C={navy:'102B57',blue:'2563EB',cyan:'16A9DF',green:'16A34A',amber:'D97706',red:'DC2626',teal:'0F8FA8',ink:'10213D',slate:'53657D',muted:'7B8DA6',line:'D9E4F2',bg:'F4F7FB',white:'FFFFFF',sky:'7DD3FC'};
const clean=value=>String(value??'').trim();
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const fmt=value=>num(value).toLocaleString('es-MX',{maximumFractionDigits:0});
const percent=value=>`${num(value).toFixed(1)}%`;

function header(pptx,slide,model,title,kicker,page){
  slide.background={color:C.bg};
  slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:.78,fill:{color:C.navy},line:{color:C.navy}});
  slide.addShape(pptx.ShapeType.rect,{x:0,y:.78,w:13.333,h:.055,fill:{color:C.cyan},line:{color:C.cyan}});
  slide.addShape(pptx.ShapeType.roundRect,{x:.23,y:.1,w:2.82,h:.55,rectRadius:.04,fill:{color:C.white},line:{color:C.white}});
  slide.addImage({path:'/logo-cr3-drive.png',x:.34,y:.15,w:.82,h:.41});
  slide.addImage({path:'/logos-marcas-negros.png',x:1.32,y:.2,w:1.58,h:.26});
  slide.addText(clean(kicker).toUpperCase(),{x:3.28,y:.12,w:4.2,h:.16,fontFace:'Aptos',fontSize:8.5,bold:true,color:C.sky,charSpacing:1.15,margin:0});
  slide.addText('CR3 DRIVE INTELLIGENCE 360',{x:3.28,y:.36,w:5.7,h:.21,fontFace:'Aptos Display',fontSize:14.5,bold:true,color:C.white,margin:0});
  slide.addText(title,{x:.5,y:1.02,w:12.2,h:.48,fontFace:'Aptos Display',fontSize:28,bold:true,color:C.ink,margin:0,fit:'shrink'});
  slide.addText(model.scope,{x:.52,y:1.5,w:12,h:.25,fontFace:'Aptos',fontSize:11.5,color:C.slate,margin:0,fit:'shrink'});
  slide.addText(model.scope,{x:.45,y:7.14,w:10.8,h:.14,fontFace:'Aptos',fontSize:7.5,color:C.muted,margin:0,fit:'shrink'});
  slide.addText(String(page),{x:12.45,y:7.12,w:.4,h:.15,fontFace:'Aptos',fontSize:8,bold:true,color:C.muted,align:'right',margin:0});
}

function card(pptx,slide,{x,y,w,h,label,value,detail,color=C.blue}){
  const text=clean(value);
  slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.05,fill:{color:C.white},line:{color:C.line,width:1}});
  slide.addShape(pptx.ShapeType.rect,{x,y,w,h:.07,fill:{color},line:{color}});
  slide.addText(clean(label).toUpperCase(),{x:x+.16,y:y+.17,w:w-.32,h:.17,fontFace:'Aptos',fontSize:8.5,bold:true,color:C.muted,charSpacing:.4,margin:0,fit:'shrink'});
  slide.addText(text,{x:x+.16,y:y+.4,w:w-.32,h:.48,fontFace:'Aptos Display',fontSize:text.length>18?17:26,bold:true,color:C.ink,margin:0,fit:'shrink'});
  slide.addText(clean(detail),{x:x+.16,y:y+h-.3,w:w-.32,h:.16,fontFace:'Aptos',fontSize:8.5,color:C.slate,margin:0,fit:'shrink'});
}

function insight(pptx,slide,text,y=6.25,color=C.blue){
  slide.addShape(pptx.ShapeType.roundRect,{x:.5,y,w:12.3,h:.62,rectRadius:.04,fill:{color:'EEF5FF'},line:{color:'BCD4F6',width:.8}});
  slide.addText('LECTURA EJECUTIVA',{x:.68,y:y+.21,w:1.48,h:.14,fontFace:'Aptos',fontSize:7.5,bold:true,color,charSpacing:.5,margin:0});
  slide.addText(clean(text),{x:2.22,y:y+.1,w:10.32,h:.4,fontFace:'Aptos',fontSize:10.5,color:C.ink,margin:0,fit:'shrink',valign:'middle'});
}

function bar(pptx,slide,rows,{x,y,w,h,name='Prospectos',color=C.blue,maxRows=12}={}){
  const data=(rows||[]).slice(0,maxRows);
  if(!data.length)return;
  slide.addChart(pptx.ChartType.bar,[{name,labels:data.map(row=>clean(row.label)),values:data.map(row=>num(row.value??row.records))}],{x,y,w,h,showTitle:false,showLegend:false,showValue:true,dataLabelPosition:'outEnd',dataLabelColor:C.ink,dataLabelFormatCode:'#,##0',catAxisLabelFontFace:'Aptos',catAxisLabelFontSize:9,valAxisLabelFontFace:'Aptos',valAxisLabelFontSize:8,showGridLines:true,valGridLine:{color:'DDE6F2',width:.6},chartColors:[color],gapWidthPct:42,border:{color:'C8D7E8',pt:.5}});
}

function column(pptx,slide,rows,{x,y,w,h,name='Prospectos',color=C.teal}={}){
  const data=(rows||[]).slice(0,14);
  if(!data.length)return;
  slide.addChart(pptx.ChartType.bar,[{name,labels:data.map(row=>clean(row.label)),values:data.map(row=>num(row.value??row.records))}],{x,y,w,h,barDir:'col',showTitle:false,showLegend:false,showValue:true,dataLabelPosition:'outEnd',dataLabelColor:C.ink,dataLabelFormatCode:'#,##0',catAxisLabelFontFace:'Aptos',catAxisLabelFontSize:8,valAxisLabelFontFace:'Aptos',valAxisLabelFontSize:8,showGridLines:true,valGridLine:{color:'DDE6F2',width:.6},chartColors:[color],gapWidthPct:45,border:{color:'C8D7E8',pt:.5}});
}

function bullets(pptx,slide,items,{x=.62,y=1.88,w=12,h=4.7,color=C.blue,fontSize=15}={}){
  const rows=(items||[]).filter(Boolean).slice(0,7),rowH=h/Math.max(1,rows.length);
  rows.forEach((item,index)=>{const top=y+index*rowH;slide.addShape(pptx.ShapeType.ellipse,{x,y:top+.11,w:.2,h:.2,fill:{color:item.color||color},line:{color:item.color||color}});slide.addText(clean(item.title||item),{x:x+.34,y:top,w:3.15,h:.4,fontFace:'Aptos Display',fontSize,bold:true,color:C.ink,margin:0,fit:'shrink',valign:'mid'});slide.addText(clean(item.detail||''),{x:x+3.6,y:top,w:w-3.9,h:.48,fontFace:'Aptos',fontSize:Math.max(10.5,fontSize-3),color:C.slate,margin:0,fit:'shrink',valign:'middle'});if(index<rows.length-1)slide.addShape(pptx.ShapeType.line,{x:x+.32,y:top+rowH-.07,w:w-.32,h:0,line:{color:C.line,width:.6}});});
}

function table(pptx,slide,headers,rows,widths,{x=.55,y=1.87,w=12.2,h=4.95,fontSize=9.2}={}){
  const body=(rows||[]).slice(0,15).map(row=>row.map(value=>({text:clean(value),options:{color:C.ink}})));
  slide.addTable([headers.map(value=>({text:clean(value),options:{bold:true,color:C.white,fill:C.navy,align:'center'}})),...body],{x,y,w,h,colW:widths,border:{type:'solid',color:C.line,pt:.65},fill:C.white,color:C.ink,fontFace:'Aptos',fontSize,margin:.06,valign:'middle',autoFit:false,autoPage:false,breakLine:false,rowH:.3});
}

export async function buildProspectingPresentation(model,onProgress=()=>{}){
  const {default:PptxGenJS}=await import('pptxgenjs');
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='Grupo CR3';pptx.company='Grupo CR3';pptx.subject='Análisis ejecutivo de prospección';pptx.title=`Prospección · ${model.periodLabel}`;pptx.lang='es-MX';pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'es-MX'};
  let page=0;
  const add=(title,kicker)=>{page++;const slide=pptx.addSlide();header(pptx,slide,model,title,kicker,page);return slide;};
  onProgress({percent:8,stage:'Preparando portada'});
  page++;let s=pptx.addSlide();s.background={color:C.navy};s.addShape(pptx.ShapeType.rect,{x:0,y:6.82,w:13.333,h:.68,fill:{color:C.cyan},line:{color:C.cyan}});s.addShape(pptx.ShapeType.roundRect,{x:.58,y:.44,w:3.9,h:.9,rectRadius:.05,fill:{color:C.white},line:{color:C.white}});s.addImage({path:'/logo-cr3-drive.png',x:.75,y:.58,w:1.18,h:.62});s.addImage({path:'/logos-marcas-negros.png',x:2.2,y:.72,w:2.1,h:.35});s.addText('INTELIGENCIA DE PROSPECCIÓN',{x:.82,y:1.78,w:11.4,h:.35,fontFace:'Aptos',fontSize:16,bold:true,color:C.sky,charSpacing:2.1,margin:0});s.addText('Origen, territorio e interés comercial',{x:.82,y:2.28,w:11.5,h:1.1,fontFace:'Aptos Display',fontSize:41,bold:true,color:C.white,margin:0,fit:'shrink'});s.addText(model.scope,{x:.84,y:3.73,w:11.3,h:.5,fontFace:'Aptos',fontSize:20,bold:true,color:C.white,margin:0,fit:'shrink'});s.addText('Lectura ejecutiva de volumen, calidad, canales, sucursales, zonas, unidades, horarios y productividad comercial.',{x:.84,y:4.46,w:11.4,h:.52,fontFace:'Aptos',fontSize:15,color:'DCE9FA',margin:0});s.addText(`Generada el ${model.generatedLabel}`,{x:.84,y:5.42,w:5,h:.2,fontFace:'Aptos',fontSize:9.5,color:'AFC4DF',margin:0});
  onProgress({percent:20,stage:'Construyendo resumen ejecutivo'});
  s=add('Resumen ejecutivo de prospección','Resumen');model.cards.slice(0,8).forEach((item,index)=>card(pptx,s,{x:.52+(index%4)*3.08,y:1.92+Math.floor(index/4)*1.55,w:2.86,h:1.34,...item}));insight(pptx,s,model.executiveInsight,5.35);
  s=add('Hallazgos que requieren decisión','Diagnóstico directivo');bullets(pptx,s,model.findings,{y:1.9,h:4.85,fontSize:15.5});
  onProgress({percent:38,stage:'Integrando medios y sucursales'});
  s=add('Mezcla de medios y dependencia de canal','Origen de demanda');bar(pptx,s,model.media,{x:.55,y:1.9,w:5.8,h:3.95,color:C.blue});table(pptx,s,['Medio','Prospectos','Participación','Variación'],model.media.slice(0,10).map(row=>[row.label,fmt(row.records),percent(row.share),row.variationLabel||'Sin base']),[2.5,1.1,1.2,1.25],{x:6.62,y:1.9,w:6.15,h:3.95,fontSize:8.8});insight(pptx,s,model.mediaInsight,6.12);
  s=add('Comparativo por sucursal','Red comercial');bar(pptx,s,model.branches,{x:.55,y:1.9,w:5.75,h:4.0,color:C.green});table(pptx,s,['Sucursal','KPI','Part.','Colonia','Digital','Unidad líder'],model.branches.slice(0,12).map(row=>[row.label,fmt(row.records),percent(row.share),percent(row.zonePct),percent(row.digitalPct),row.topVehicle]),[1.65,.7,.75,.8,.75,1.45],{x:6.5,y:1.9,w:6.3,h:4,fontSize:8.1});insight(pptx,s,model.branchInsight,6.12);
  onProgress({percent:55,stage:'Integrando territorio y unidades'});
  s=add('Concentración territorial y calidad de zona','Zonas');bar(pptx,s,model.zones,{x:.55,y:1.9,w:5.8,h:4.0,color:C.teal});table(pptx,s,['Zona','Sucursal','Prospectos','Medio','Unidad'],model.zones.slice(0,12).map(row=>[row.label,row.branch,fmt(row.records),row.topMedium,row.topVehicle]),[1.6,1.35,.8,1.35,1.35],{x:6.58,y:1.9,w:6.2,h:4,fontSize:8.2});insight(pptx,s,model.zoneInsight,6.12);
  s=add('Demanda declarada por unidad','Interés de producto');bar(pptx,s,model.vehicles,{x:.55,y:1.9,w:5.8,h:4.0,color:C.blue});table(pptx,s,['Unidad','Menciones','1ª opción','2ª opción','Sucursal líder','Medio líder'],model.vehicles.slice(0,12).map(row=>[row.label,fmt(row.records),fmt(row.primary),fmt(row.secondary),row.topBranch,row.topMedium]),[1.65,.75,.75,.75,1.35,1.25],{x:6.58,y:1.9,w:6.2,h:4,fontSize:8.1});insight(pptx,s,model.vehicleInsight,6.12);
  onProgress({percent:70,stage:'Integrando horario, calidad y equipos'});
  s=add('Patrón temporal de llegada','Día y horario');column(pptx,s,model.days,{x:.55,y:1.9,w:5.8,h:3.95,color:C.blue});column(pptx,s,model.hours,{x:6.62,y:1.9,w:6.15,h:3.95,color:C.teal});insight(pptx,s,model.timeInsight,6.12);
  s=add('Calidad del dato y capacidad de seguimiento','Calidad');model.quality.forEach((item,index)=>card(pptx,s,{x:.55+index*3.08,y:1.95,w:2.82,h:1.43,...item}));bar(pptx,s,model.nonKpi,{x:.58,y:3.67,w:5.75,h:2.08,name:'Registros',color:C.red,maxRows:7});bar(pptx,s,model.classifications,{x:6.62,y:3.67,w:6.12,h:2.08,name:'Registros',color:C.amber,maxRows:7});insight(pptx,s,model.qualityInsight,6.12);
  s=add('Productividad y mezcla por equipo','Gerentes y APV');table(pptx,s,['Gerente','KPI','Part.','Digital','Colonia','Unidad líder'],model.managers.slice(0,12).map(row=>[row.label,fmt(row.records),percent(row.share),percent(row.digitalPct),percent(row.zonePct),row.topVehicle]),[1.65,.7,.75,.8,.8,1.45],{x:.55,y:1.9,w:6.0,h:4.0,fontSize:8.2});table(pptx,s,['APV','KPI','Part.','Digital','Colonia','Sucursal'],model.apvs.slice(0,12).map(row=>[row.label,fmt(row.records),percent(row.share),percent(row.digitalPct),percent(row.zonePct),row.topBranch]),[1.75,.7,.75,.8,.8,1.25],{x:6.75,y:1.9,w:6.0,h:4.0,fontSize:8.2});insight(pptx,s,model.teamInsight,6.12);
  if(model.conversion){s=add('Conversión trazable del prospecto','Funnel integral');model.conversion.stageRows.slice(0,7).forEach((row,index)=>card(pptx,s,{x:.5+index*1.82,y:1.92,w:1.62,h:1.35,label:row.label,value:fmt(row.value),detail:index?`${row.stepRate.toFixed(1)}% etapa anterior`:'Base trazable',color:index===0?C.blue:index===6?C.green:C.cyan}));bar(pptx,s,model.conversion.byMedium,{x:.58,y:3.62,w:5.95,h:2.3,name:'Prospectos',color:C.blue,maxRows:8});table(pptx,s,['Medio','Pros.','Demos','Solic.','Ventas','Conv.'],model.conversion.byMedium.slice(0,9).map(row=>[row.label,fmt(row.prospects),fmt(row.demo),fmt(row.application),fmt(row.sale),percent(row.saleRate)]),[2.0,.7,.7,.75,.7,.8],{x:6.72,y:3.62,w:6.0,h:2.3,fontSize:8.1});insight(pptx,s,`${model.conversion.matched} prospectos tienen actividad posterior identificable, equivalentes a ${model.conversion.matchRate.toFixed(1)}% de la base trazable. La mediana observada hacia venta es ${model.conversion.medianSale??'sin base'} días.`,6.15);}
  if(model.demand?.length){s=add('Demanda, inventario y ventas por unidad','Producto');table(pptx,s,['Unidad','Prospectos','Inventario','Ventas','Pros./unidad','Lectura'],model.demand.slice(0,14).map(row=>[row.label,fmt(row.prospects),fmt(row.inventory),fmt(row.sales),row.prospectsPerUnit==null?'Sin inventario':row.prospectsPerUnit.toFixed(1),!row.inventory&&row.prospects?'Demanda sin inventario':row.inventory&&row.prospects/row.inventory<1?'Falta tráfico':row.sales>row.inventory?'Alta rotación':'Equilibrio activo']),[2.1,1.0,1.0,.8,1.1,2.1],{x:.58,y:1.9,w:12.1,h:4.2,fontSize:9});insight(pptx,s,'La comparación utiliza el inventario de apertura del periodo. Los modelos sin disponibilidad requieren reubicación o reposición; los modelos con inventario y baja intención requieren generación de tráfico.',6.2);}
  onProgress({percent:86,stage:'Construyendo plan de acción'});
  s=add('Plan de acción recomendado','Estrategia');bullets(pptx,s,model.actions,{y:1.88,h:4.95,color:C.green,fontSize:15});
  s=add('Metodología y alcance','Notas técnicas');bullets(pptx,s,model.methodology,{y:1.9,h:4.9,color:C.teal,fontSize:14.5});
  onProgress({percent:96,stage:'Guardando PowerPoint'});
  await pptx.writeFile({fileName:model.fileName||`Prospeccion_Ejecutiva_${model.periodToken}.pptx`});
  onProgress({percent:100,stage:'Presentación terminada'});
}
