import {branchSelectionLabel} from './BranchMultiSelect';

// Conserva todos los campos, incluidos los que se agreguen en el futuro.
// Las cadenas que exceden el límite de Excel se dividen sin truncarlas.
export function completeExportRows(records=[]){
 const fragments=[];
 const flat=records.map((record,index)=>{const result={};const visit=(value,path)=>{if(value===null||value===undefined){result[path]='';return;}if(Array.isArray(value)){if(!value.length)result[path]='[]';else value.forEach((item,i)=>visit(item,`${path}[${i}]`));return;}if(typeof value==='object'){const entries=Object.entries(value);if(!entries.length)result[path]='{}';else entries.forEach(([key,item])=>visit(item,path?`${path}.${key}`:key));return;}if(typeof value==='string'&&value.length>30000){const id=String(record.id||`fila-${index+1}`),parts=Math.ceil(value.length/30000);for(let i=0;i<parts;i++)fragments.push({Registro:id,Campo:path,Parte:i+1,Total:parts,Contenido:value.slice(i*30000,(i+1)*30000)});result[path]=`Contenido en hoja Fragmentos (${parts} partes)`;return;}result[path]=value;};Object.entries(record||{}).forEach(([key,value])=>visit(value,key));return result;});return {rows:flat,fragments};
}
export function appendCompleteResults(XLSX,book,records){const {rows,fragments}=completeExportRows(records);const sheet=XLSX.utils.json_to_sheet(rows);sheet['!freeze']={xSplit:0,ySplit:1};XLSX.utils.book_append_sheet(book,sheet,'Datos completos');if(fragments.length)XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(fragments),'Fragmentos');}
export function resultsFilterDescription({selectedMonth,periodMode,rangeStart,rangeEnd,dayStart,dayEnd,branchScope,managerFilter,vendorFilter,brand,branchType,extra=''}={}){
 const period=periodMode==='dias'?`${dayStart||'—'} a ${dayEnd||'—'}`:periodMode==='periodo'?`${rangeStart||'—'} a ${rangeEnd||'—'}`:periodMode==='acumulado'?`Enero a ${selectedMonth}`:selectedMonth||'Sin periodo';
 return `Periodo: ${period}${brand?` · Marca: ${brand==='todas'?'Todas':brand}`:''}${branchType?` · Tipo: ${branchType}`:''} · Sucursal: ${branchSelectionLabel(branchScope,'todas')} · Gerente: ${managerFilter==='todos'?'Todos':managerFilter||'Todos'} · APV: ${vendorFilter==='todos'?'Todos':vendorFilter||'Todos'}${extra?` · ${extra}`:''}`;
}
function loadReportLogo(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,1000/img.naturalWidth,500/img.naturalHeight),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve({data:canvas.toDataURL('image/jpeg',.9),width:canvas.width,height:canvas.height});};img.onerror=()=>reject(new Error('No fue posible cargar los logotipos del reporte.'));img.src=src;});}
function addLogoWithin(pdf,img,x,y,width,height,alias){const ratio=Math.min(width/img.width,height/img.height),w=img.width*ratio,h=img.height*ratio;pdf.addImage(img.data,'JPEG',x+(width-w)/2,y+(height-h)/2,w,h,alias,'FAST');}
// Convierte las tablas renderizadas en texto y líneas PDF reales: conserva
// ambos periodos sin rasterizar encabezados ni limitarse al área visible.
function reportRows(panel){return Array.from(panel?.querySelectorAll('table')||[]).flatMap(table=>{const columns=table.classList.contains('status-summary')?3:table.classList.contains('report-general')?12:7;return Array.from(table.rows).filter(row=>!row.classList.contains('general-spacer')).map(row=>({columns,style:row.className||'',header:row.parentElement?.tagName==='THEAD',cells:Array.from(row.cells).map(cell=>({text:(cell.getAttribute('aria-label')||cell.textContent||'').replace(/\s+/g,' ').trim(),span:cell.colSpan||1}))}));});}
function measureReportRow(pdf,row,width){const base=width*.25,other=(width-base)/(row.columns-1),font=5.5,vertical=row.header&&row.columns===12;pdf.setFont('helvetica',row.header||/general-total|direction-grand|subtotal|group|manager/.test(row.style)?'bold':'normal');pdf.setFontSize(font);let column=0,maxLines=1,maxVertical=0;const cells=row.cells.map(cell=>{const first=column===0;let w=0;for(let n=0;n<cell.span;n++,column++)w+=column===0?base:other;const rotated=vertical&&!first;const lines=rotated?[cell.text||' ']:pdf.splitTextToSize(cell.text||' ',Math.max(2,w-2));maxLines=Math.max(maxLines,lines.length);if(rotated)maxVertical=Math.max(maxVertical,pdf.getTextWidth(cell.text||''));return {...cell,width:w,lines,rotated};});return {cells,height:Math.max(4,maxLines*2.35+1.3,maxVertical+3),font};}
function paintReportRow(pdf,measured,row,x,y){let color=[255,255,255];if(/general-total|direction-grand/.test(row.style))color=[23,75,145];else if(/subtotal/.test(row.style))color=[216,233,255];else if(/group|manager/.test(row.style))color=[229,239,255];else if(row.header)color=[237,243,251];const dark=/general-total|direction-grand/.test(row.style);pdf.setLineWidth(.12);pdf.setDrawColor(180,195,213);pdf.setFont('helvetica',row.header||dark||/subtotal|group|manager/.test(row.style)?'bold':'normal');pdf.setFontSize(measured.font);let at=x;measured.cells.forEach((cell,i)=>{pdf.setFillColor(...color);pdf.rect(at,y,cell.width,measured.height,'FD');pdf.setTextColor(...(dark?[255,255,255]:[23,52,95]));if(cell.rotated)pdf.text(cell.lines[0],at+cell.width/2+.65,y+measured.height-1.5,{angle:90});else pdf.text(cell.lines,at+(i?cell.width/2:.8),y+2.1,{align:i?'center':'left',lineHeightFactor:1.12});at+=cell.width;});pdf.setTextColor(20,33,61);}
export function appendVectorReports({pdf,target,header,newPage,top,margin,pageWidth,pageHeight}){
 const reports=target.querySelectorAll('.application-report');let pages=0;
 reports.forEach(report=>{const pair=report.querySelector('.application-comparison-row');if(!pair)return;const panels=Array.from(pair.children).slice(0,2);if(panels.length!==2)return;const queues=panels.map(reportRows),labels=panels.map(panel=>panel.querySelector('.application-period-label')?.textContent?.trim()||''),indexes=[0,0],gap=4,width=(pageWidth-2*margin-gap)/2;let guard=0;
   do{if(pages++)newPage();const before=indexes.slice();header();const subtitle=report.querySelector('h3')?.textContent||'Reporte';pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text(subtitle,margin,top);panels.forEach((panel,side)=>{const x=margin+side*(width+gap);let y=top+4;pdf.setTextColor(29,78,180);pdf.setFontSize(7);pdf.text(pdf.splitTextToSize(labels[side],width).slice(0,2),x,y);pdf.setTextColor(20,33,61);y+=5;while(indexes[side]<queues[side].length){const row=queues[side][indexes[side]],measured=measureReportRow(pdf,row,width);if(y+measured.height>pageHeight-margin-12)break;paintReportRow(pdf,measured,row,x,y);y+=measured.height;indexes[side]++;}});pdf.setFont('helvetica','normal');pdf.setFontSize(6);pdf.setTextColor(90,110,140);const note=report.querySelector('.application-note')?.textContent?.trim();const footer=['Los estatus y conversiones reflejan su estado actual, no una fotografía histórica.',...(note?[note]:[])].join(' ');pdf.text(pdf.splitTextToSize(footer,pageWidth-2*margin).slice(0,3),margin,pageHeight-margin-8,{lineHeightFactor:1.1});pdf.setTextColor(20,33,61);if(indexes.every((value,side)=>value===before[side])||++guard>10000)throw new Error('El reporte contiene una fila demasiado extensa para la página.');}while(indexes.some((value,side)=>value<queues[side].length));
 });return pages;
}
export async function exportResultsPdf({target,title,filters,fileName,ignoreClass,vectorTables=false}){
 if(!target)throw new Error('Abre el análisis antes de exportar.');
 const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
 const [logoDrive,logoBrands]=await Promise.all([loadReportLogo('/logo-cr3-drive.png'),loadReportLogo('/logos-marcas-negros.png')]);
 const selector='.gm-table-wrap,.application-scroll,.demo-table-wrap,.trade-table-wrap,.appraisal-table-wrap,.insurance-table-wrap,.delivery-table-wrap,.delivery-report-scroll';
 const captureWidth=Math.max(Math.ceil(target.getBoundingClientRect().width),...Array.from(target.querySelectorAll(selector),el=>el.scrollWidth||0));
 const canvas=await html2canvas(target,{width:captureWidth,windowWidth:Math.max(window.innerWidth,captureWidth),scale:2,backgroundColor:'#f4f7fb',useCORS:true,logging:false,ignoreElements:el=>ignoreClass&&el.classList?.contains(ignoreClass),onclone:(doc,clone)=>{
   clone.style.width=`${captureWidth}px`;clone.style.maxWidth='none';
   doc.querySelectorAll(selector).forEach(el=>{el.style.overflow='visible';el.style.maxHeight='none';});
   if(vectorTables)clone.querySelectorAll('.application-report,.application-compare-controls').forEach(el=>{el.style.display='none';});
   // html2canvas no interpreta bien writing-mode vertical. En la copia para
   // el PDF, coloca cada texto horizontal y gíralo en su propia celda.
   clone.querySelectorAll('.report-general thead .vertical-label').forEach(label=>{
     const cell=label.parentElement;if(cell)cell.style.position='relative';
     Object.assign(label.style,{writingMode:'horizontal-tb',position:'absolute',left:'50%',top:'50%',width:'90px',height:'12px',lineHeight:'12px',margin:'0',textAlign:'center',whiteSpace:'nowrap',fontSize:label.textContent.trim().length>17?'7px':'8px',transform:'translate(-50%, -50%) rotate(-90deg)',transformOrigin:'center center'});
   });
 }});
 if(!canvas.width||!canvas.height)throw new Error('El análisis no tiene contenido visible.');
 const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'letter',compress:true}),pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight(),margin=8,top=31,uw=pw-2*margin,uh=ph-top-margin,pageHeight=Math.max(1,Math.floor(canvas.width*uh/uw));
 const header=()=>{
   pdf.setFillColor(16,43,87);pdf.rect(margin,5,uw,20,'F');
   pdf.setFillColor(255,255,255);pdf.roundedRect(margin+2,7,69,16,2,2,'F');
   addLogoWithin(pdf,logoDrive,margin+4,8,21,14,'logoDrive');addLogoWithin(pdf,logoBrands,margin+27,9,41,12,'logoBrands');
   pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.text(title,margin+75,11);
   pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.text(pdf.splitTextToSize(filters||'Filtros actuales',uw-80).slice(0,2),margin+75,16);pdf.setTextColor(20,33,61);
 };
 const reportPages=vectorTables?appendVectorReports({pdf,target,header,newPage:()=>pdf.addPage(),top,margin,pageWidth:pw,pageHeight:ph}):0;
 for(let offset=0,page=0;offset<canvas.height;offset+=pageHeight,page++){
   if(page||reportPages)pdf.addPage();header();
   const crop=document.createElement('canvas');crop.width=canvas.width;crop.height=Math.min(pageHeight,canvas.height-offset);crop.getContext('2d').drawImage(canvas,0,offset,canvas.width,crop.height,0,0,canvas.width,crop.height);pdf.addImage(crop.toDataURL('image/jpeg',.96),'JPEG',margin,top,uw,Math.min(uh,crop.height/crop.width*uw));
 }
 pdf.save(fileName);
}
