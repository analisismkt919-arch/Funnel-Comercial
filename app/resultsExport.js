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
function loadReportLogo(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('No fue posible cargar los logotipos del reporte.'));img.src=src;});}
function addLogoWithin(pdf,img,x,y,width,height){const ratio=Math.min(width/img.naturalWidth,height/img.naturalHeight),w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;pdf.addImage(img,'PNG',x+(width-w)/2,y+(height-h)/2,w,h);}
export async function exportResultsPdf({target,title,filters,fileName,ignoreClass}){
 if(!target)throw new Error('Abre el análisis antes de exportar.');
 const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
 const [logoDrive,logoBrands]=await Promise.all([loadReportLogo('/logo-cr3-drive.png'),loadReportLogo('/logos-marcas-negros.png')]);
 const selector='.gm-table-wrap,.application-scroll,.demo-table-wrap,.trade-table-wrap,.appraisal-table-wrap,.insurance-table-wrap,.delivery-table-wrap,.delivery-report-scroll';
 const captureWidth=Math.max(Math.ceil(target.getBoundingClientRect().width),...Array.from(target.querySelectorAll(selector),el=>el.scrollWidth||0));
 const canvas=await html2canvas(target,{width:captureWidth,windowWidth:Math.max(window.innerWidth,captureWidth),scale:1.2,backgroundColor:'#f4f7fb',useCORS:true,logging:false,ignoreElements:el=>ignoreClass&&el.classList?.contains(ignoreClass),onclone:(doc,clone)=>{
   clone.style.width=`${captureWidth}px`;clone.style.maxWidth='none';
   doc.querySelectorAll(selector).forEach(el=>{el.style.overflow='visible';el.style.maxHeight='none';});
   // html2canvas no interpreta bien writing-mode vertical. En la copia para
   // el PDF, coloca cada texto horizontal y gíralo en su propia celda.
   clone.querySelectorAll('.report-general thead .vertical-label').forEach(label=>{
     const cell=label.parentElement;if(cell)cell.style.position='relative';
     Object.assign(label.style,{writingMode:'horizontal-tb',position:'absolute',left:'50%',top:'50%',width:'90px',height:'12px',lineHeight:'12px',margin:'0',textAlign:'center',whiteSpace:'nowrap',fontSize:label.textContent.trim().length>17?'7px':'8px',transform:'translate(-50%, -50%) rotate(-90deg)',transformOrigin:'center center'});
   });
 }});
 if(!canvas.width||!canvas.height)throw new Error('El análisis no tiene contenido visible.');
 const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'letter'}),pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight(),margin=8,top=31,uw=pw-2*margin,uh=ph-top-margin,pageHeight=Math.max(1,Math.floor(canvas.width*uh/uw));
 for(let offset=0,page=0;offset<canvas.height;offset+=pageHeight,page++){
   if(page)pdf.addPage();
   pdf.setFillColor(16,43,87);pdf.rect(margin,5,uw,20,'F');
   pdf.setFillColor(255,255,255);pdf.roundedRect(margin+2,7,69,16,2,2,'F');
   addLogoWithin(pdf,logoDrive,margin+4,8,21,14);addLogoWithin(pdf,logoBrands,margin+27,9,41,12);
   pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.text(title,margin+75,11);
   pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.text(pdf.splitTextToSize(filters||'Filtros actuales',uw-80).slice(0,2),margin+75,16);pdf.setTextColor(20,33,61);
   const crop=document.createElement('canvas');crop.width=canvas.width;crop.height=Math.min(pageHeight,canvas.height-offset);crop.getContext('2d').drawImage(canvas,0,offset,canvas.width,crop.height,0,0,canvas.width,crop.height);pdf.addImage(crop.toDataURL('image/jpeg',.92),'JPEG',margin,top,uw,Math.min(uh,crop.height/crop.width*uw));
 }
 pdf.save(fileName);
}
