import fs from 'node:fs';
import XLSX from 'xlsx';

const ROOT='.tmp-shapes-new';
const currentBoundaries=JSON.parse(fs.readFileSync('public/geo-boundaries-chihuahua.json','utf8'));
const currentStreets=JSON.parse(fs.readFileSync('public/geo-streets-chihuahua.json','utf8'));
const normalize=value=>String(value||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/&/g,' Y ')
  .replace(/[º°ª]/g,' ')
  .replace(/[^A-Z0-9]+/gi,' ')
  .trim().replace(/\s+/g,' ').toUpperCase();
const SETTLEMENT_PREFIX=/^(?:COLONIA|FRACCIONAMIENTO|BARRIO|RANCHERIA|RANCHO|EJIDO|PUEBLO|UNIDAD HABITACIONAL|RESIDENCIAL|CONJUNTO HABITACIONAL|AMPLIACION|ZONA INDUSTRIAL|PARQUE INDUSTRIAL|GRANJA|GRANJAS)\s+/;
const nameVariants=value=>{
  const normalized=normalize(value),withoutType=normalized.replace(SETTLEMENT_PREFIX,''),withoutQualifier=normalize(String(value||'').replace(/\([^)]*\)/g,'')).replace(SETTLEMENT_PREFIX,''),compact=withoutType.replace(/\s/g,''),sorted=withoutType.split(' ').sort().join(' ');
  return [...new Set([normalized,withoutType,withoutQualifier,compact,sorted].filter(Boolean))];
};
const stateCode=value=>normalize(value)==='CHIHUAHUA'?'08':normalize(value)==='ZACATECAS'?'32':'';
const catalogPaths=process.argv.slice(2).filter(Boolean);
const readPostalCatalog=paths=>paths.flatMap(path=>{
  if(!fs.existsSync(path))throw new Error(`No se encontró el catálogo postal: ${path}`);
  const workbook=XLSX.readFile(path,{raw:false});
  return workbook.SheetNames.filter(name=>normalize(name)!=='NOTA').flatMap(name=>XLSX.utils.sheet_to_json(workbook.Sheets[name],{defval:''})).map(row=>({
    cp:String(row.d_codigo||'').padStart(5,'0'),
    colonia:row.d_asenta||'',
    municipio:row.D_mnpio||row.d_mnpio||'',
    state:stateCode(row.d_estado)
  })).filter(row=>row.state&&/^\d{5}$/.test(row.cp)&&row.colonia&&row.municipio);
});
const postalCatalog=readPostalCatalog(catalogPaths);
const postalIndex=new Map();
const postalByMunicipality=new Map();
for(const row of postalCatalog){
  for(const municipio of nameVariants(row.municipio))for(const colonia of nameVariants(row.colonia)){
    const key=`${row.state}|${municipio}|${colonia}`;
    if(!postalIndex.has(key))postalIndex.set(key,new Set());
    postalIndex.get(key).add(row.cp);
  }
  for(const municipio of nameVariants(row.municipio)){
    const key=`${row.state}|${municipio}`;
    if(!postalByMunicipality.has(key))postalByMunicipality.set(key,[]);
    postalByMunicipality.get(key).push(row);
  }
}
const editDistance=(a,b)=>{const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=old;}}return row[b.length];};
const similarity=(a,b)=>{const left=normalize(a).replace(/\s/g,''),right=normalize(b).replace(/\s/g,'');return left&&right?1-editDistance(left,right)/Math.max(left.length,right.length):0;};
const tokenOverlap=(a,b)=>{const left=new Set(normalize(a).replace(SETTLEMENT_PREFIX,'').split(' ').filter(Boolean)),right=new Set(normalize(b).replace(SETTLEMENT_PREFIX,'').split(' ').filter(Boolean)),intersection=[...left].filter(token=>right.has(token)).length,union=new Set([...left,...right]).size;return union?intersection/union:0;};
const enrichPostalCode=feature=>{
  const original=String(feature.cp||'').padStart(5,'0');
  if(original!=='00000'&&/^\d{5}$/.test(original))return {...feature,cp:original,cpSource:'INEGI'};
  const candidates=new Set();
  for(const municipio of nameVariants(feature.municipio))for(const colonia of nameVariants(feature.colonia)){
    for(const cp of postalIndex.get(`${feature.state}|${municipio}|${colonia}`)||[])candidates.add(cp);
  }
  if(candidates.size===1)return {...feature,cp:[...candidates][0],cpSource:'Correos de México',cpMatch:'estado+municipio+colonia'};
  if(!candidates.size&&normalize(feature.colonia)!=='NINGUNO'){
    const rows=[...new Set(nameVariants(feature.municipio).flatMap(municipio=>postalByMunicipality.get(`${feature.state}|${municipio}`)||[]))];
    const ranked=rows.map(row=>({...row,score:Math.max(...nameVariants(feature.colonia).flatMap(left=>nameVariants(row.colonia).map(right=>similarity(left,right)))),overlap:tokenOverlap(feature.colonia,row.colonia)})).sort((a,b)=>b.score-a.score);
    const best=ranked[0],second=ranked.find(row=>row.cp!==best?.cp);
    if(best&&best.score>=.9&&best.overlap>=.6&&(!second||best.score-second.score>=.06))return {...feature,cp:best.cp,cpSource:'Correos de México',cpMatch:'nombre aproximado controlado',cpConfidence:Number(best.score.toFixed(3)),cpCatalogName:best.colonia};
  }
  return {...feature,cp:'00000',cpSource:'sin coincidencia',cpMatch:candidates.size?'ambiguo':'no encontrado',cpCandidates:[...candidates]};
};
const deg=value=>value*Math.PI/180;
const lccToLonLat=(x,y)=>{
  const a=6378137,f=1/298.257222101,e=Math.sqrt(f*(2-f));
  const phi1=deg(17.5),phi2=deg(29.5),phi0=deg(12),lambda0=deg(-102),falseE=2500000;
  const m=phi=>Math.cos(phi)/Math.sqrt(1-e*e*Math.sin(phi)**2);
  const t=phi=>Math.tan(Math.PI/4-phi/2)/(((1-e*Math.sin(phi))/(1+e*Math.sin(phi)))**(e/2));
  const n=(Math.log(m(phi1))-Math.log(m(phi2)))/(Math.log(t(phi1))-Math.log(t(phi2)));
  const F=m(phi1)/(n*t(phi1)**n),rho0=a*F*t(phi0)**n,dx=x-falseE,dy=rho0-y;
  const rho=Math.sign(n)*Math.hypot(dx,dy),theta=Math.atan2(dx,dy),target=(rho/(a*F))**(1/n);
  let phi=Math.PI/2-2*Math.atan(target);
  for(let iteration=0;iteration<8;iteration++)phi=Math.PI/2-2*Math.atan(target*(((1-e*Math.sin(phi))/(1+e*Math.sin(phi)))**(e/2)));
  return[lambda0+theta/n,phi];
};
const lonLatToUtm13=([lambda,phi])=>{
  const a=6378137,f=1/298.257223563,e2=f*(2-f),ep2=e2/(1-e2),k0=.9996,lambda0=deg(-105);
  const sin=Math.sin(phi),cos=Math.cos(phi),tan=Math.tan(phi),N=a/Math.sqrt(1-e2*sin*sin),T=tan*tan,C=ep2*cos*cos,A=cos*(lambda-lambda0);
  const M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*phi-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*phi)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*phi)-(35*e2**3/3072)*Math.sin(6*phi));
  return[500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120),k0*(M+N*tan*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720))];
};
const project=(x,y)=>lonLatToUtm13(lccToLonLat(x,y)).map(Math.round);
const decode=buffer=>buffer.toString('latin1').replace(/[\x80-\x9f]/g,char=>({
  '\x80':'€','\x82':'‚','\x83':'ƒ','\x84':'„','\x85':'…','\x86':'†','\x87':'‡','\x88':'ˆ','\x89':'‰','\x8a':'Š','\x8b':'‹','\x8c':'Œ','\x8e':'Ž','\x91':'‘','\x92':'’','\x93':'“','\x94':'”','\x95':'•','\x96':'–','\x97':'—','\x98':'˜','\x99':'™','\x9a':'š','\x9b':'›','\x9c':'œ','\x9e':'ž','\x9f':'Ÿ'
}[char]||char)).trim();

const readDbf=path=>{
  const dbf=fs.readFileSync(path),headerLength=dbf.readUInt16LE(8),recordLength=dbf.readUInt16LE(10),count=dbf.readUInt32LE(4),fields=[];
  let accumulated=1;
  for(let offset=32;dbf[offset]!==13;offset+=32){const name=dbf.subarray(offset,offset+11).toString('latin1').replace(/\0.*$/,'');const length=dbf[offset+16];fields.push({name,offset:accumulated,length});accumulated+=length;}
  const records=[];
  for(let index=0;index<count;index++){const record={};for(const field of fields)record[field.name]=decode(dbf.subarray(headerLength+index*recordLength+field.offset,headerLength+index*recordLength+field.offset+field.length));records.push(record);}
  return records;
};
const reduceRing=ring=>{
  if(ring.length<=12)return ring;
  const stride=ring.length>180?5:ring.length>80?3:2,reduced=ring.filter((_,index)=>index===0||index===ring.length-1||index%stride===0);
  if(reduced[0][0]!==reduced.at(-1)[0]||reduced[0][1]!==reduced.at(-1)[1])reduced.push(reduced[0]);
  return reduced;
};
const readShapes=(path,{transform=true,simplify=true,include=()=>true}={})=>{
  const shp=fs.readFileSync(path),shapes=[];let offset=100;
  while(offset+8<=shp.length){const contentBytes=shp.readUInt32BE(offset+4)*2,start=offset+8,type=shp.readUInt32LE(start);let rings=[];const featureIndex=shapes.length;
    if(include(featureIndex)&&(type===5||type===3)){const partCount=shp.readUInt32LE(start+36),pointCount=shp.readUInt32LE(start+40),parts=Array.from({length:partCount},(_,part)=>shp.readUInt32LE(start+44+part*4)),pointsStart=start+44+partCount*4;
      for(let part=0;part<partCount;part++){const from=parts[part],to=part+1<partCount?parts[part+1]:pointCount,ring=[];for(let point=from;point<to;point++){const raw=[shp.readDoubleLE(pointsStart+point*16),shp.readDoubleLE(pointsStart+point*16+8)];ring.push(transform?project(...raw):raw.map(Math.round));}if(ring.length>2)rings.push(simplify?reduceRing(ring):ring);}
    }
    shapes.push(rings);offset=start+contentBytes;
  }
  return shapes;
};
const pointInRing=(point,ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>point[1])!==(b[1]>point[1]))&&(point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;};
const ringCenter=rings=>{const ring=rings[0]||[];if(!ring.length)return[0,0];return ring.reduce((sum,point)=>[sum[0]+point[0]/ring.length,sum[1]+point[1]/ring.length],[0,0]);};
const chihuahuaMunicipality=center=>currentBoundaries.municipalities.find(feature=>feature.rings.some(ring=>pointInRing(center,ring)))?.name||'';
const chihuahuaFallbackMunicipalities=new Map([['012','CARICHÍ'],['029','GUADALUPE Y CALVO'],['046','MORELOS']]);

const zacMunicipalityRecords=readDbf(`${ROOT}/zacatecas-marco/conjunto_de_datos/32mun.dbf`);
const zacMunicipalityShapes=readShapes(`${ROOT}/zacatecas-marco/conjunto_de_datos/32mun.shp`);
const zacMunicipalityNames=new Map(zacMunicipalityRecords.map(record=>[record.CVE_MUN,record.NOMGEO]));
const buildColonies=(state,base)=>{
  // Las colonias comparten límites. Simplificarlas por separado mediante un
  // muestreo de vértices crea diagonales, huecos y traslapes visuales entre
  // polígonos vecinos. Conservamos aquí la geometría completa del SHP para
  // mantener la continuidad/topología del mapa.
  const records=readDbf(`${base}.dbf`),shapes=readShapes(`${base}.shp`,{simplify:false});
  return records.flatMap((record,index)=>{const rings=shapes[index];if(!rings?.length)return[];return[{id:`${state}-${record.cvegeo||index}`,state,cp:record.cp,colonia:record.nom_asen,municipio:state==='08'?(chihuahuaMunicipality(ringCenter(rings))||chihuahuaFallbackMunicipalities.get(record.cve_mun)||''):(zacMunicipalityNames.get(record.cve_mun)||''),localidad:'',tipo:record.tipo,actualizacion:record.fecha_act,rings}];});
};
const rawColonies=[
  ...buildColonies('08',`${ROOT}/chihuahua/conjunto_de_datos/08as`),
  ...buildColonies('32',`${ROOT}/zacatecas-colonias/conjunto_de_datos/32as`)
];
const colonies=rawColonies.map(enrichPostalCode);
const bounds=colonies.flatMap(feature=>feature.rings.flat()).reduce((bbox,point)=>[Math.min(bbox[0],point[0]),Math.min(bbox[1],point[1]),Math.max(bbox[2],point[0]),Math.max(bbox[3],point[1])],[Infinity,Infinity,-Infinity,-Infinity]);
const municipalityFeatures=zacMunicipalityRecords.map((record,index)=>({id:`32-${record.CVE_MUN}`,state:'32',name:record.NOMGEO,rings:zacMunicipalityShapes[index]})).filter(feature=>feature.rings.length);
const localityRecords=readDbf(`${ROOT}/zacatecas-marco/conjunto_de_datos/32l.dbf`),localityShapes=readShapes(`${ROOT}/zacatecas-marco/conjunto_de_datos/32l.shp`);
const urbanFeatures=localityRecords.map((record,index)=>({id:`32-${record.CVE_MUN}-${record.CVE_LOC}`,state:'32',name:record.NOMGEO,scope:record.AMBITO,rings:localityShapes[index]})).filter(feature=>feature.rings.length&&/URBAN/i.test(feature.scope));
const agebRecords=readDbf(`${ROOT}/zacatecas-marco/conjunto_de_datos/32a.dbf`),agebShapes=readShapes(`${ROOT}/zacatecas-marco/conjunto_de_datos/32a.shp`);
const agebFeatures=agebRecords.map((record,index)=>({id:`32-${record.CVEGEO}`,state:'32',rings:agebShapes[index]})).filter(feature=>feature.rings.length);
const servedZacatecasMunicipalities=new Set(['FRESNILLO','ZACATECAS']);
const servedZacatecasCodes=new Set([...zacMunicipalityNames].filter(([,name])=>servedZacatecasMunicipalities.has(normalize(name))).map(([code])=>code));
const zacatecasRoadRecords=readDbf(`${ROOT}/zacatecas-marco/conjunto_de_datos/32e.dbf`);
const zacatecasRoadShapes=readShapes(`${ROOT}/zacatecas-marco/conjunto_de_datos/32e.shp`,{simplify:false,include:index=>servedZacatecasCodes.has(zacatecasRoadRecords[index]?.CVE_MUN)});
const zacatecasRoads=zacatecasRoadRecords.flatMap((record,index)=>{
  const lines=zacatecasRoadShapes[index];
  if(!servedZacatecasCodes.has(record.CVE_MUN)||!lines?.length)return[];
  const name=record.NOMVIAL||record.NOMGEO||'Vialidad sin nombre',type=record.TIPOVIAL||record.TIPO||'Vialidad',roadKind=normalize(`${type} ${name}`);
  return[{n:name,t:type,m:zacMunicipalityNames.get(record.CVE_MUN)||'',h:/CARRETERA|AUTOPISTA|LIBRAMIENTO|PERIFERICO|CORREDOR|SUPER CARRETERA/.test(roadKind)?1:0,l:lines}];
});

const regionalBoundaries={
  crs:'WGS_1984_UTM_Zone_13N',
  municipalities:[...currentBoundaries.municipalities.map(feature=>({...feature,state:'08'})),...municipalityFeatures],
  urban:[...currentBoundaries.urban.map(feature=>({...feature,state:'08'})),...urbanFeatures],
  agebs:[...currentBoundaries.agebs.map(feature=>({...feature,state:'08'})),...agebFeatures],
  meta:{source:'INEGI 2025 · Chihuahua y Zacatecas',states:['08','32'],municipalities:currentBoundaries.municipalities.length+municipalityFeatures.length,urban:currentBoundaries.urban.length+urbanFeatures.length,agebs:currentBoundaries.agebs.length+agebFeatures.length}
};
const postalStats={
  catalogRows:postalCatalog.length,
  zeroBefore:rawColonies.filter(item=>String(item.cp||'').padStart(5,'0')==='00000').length,
  corrected:colonies.filter(item=>item.cpSource==='Correos de México').length,
  fuzzy:colonies.filter(item=>item.cpMatch==='nombre aproximado controlado').length,
  ambiguous:colonies.filter(item=>item.cpMatch==='ambiguo').length,
  unmatched:colonies.filter(item=>item.cpMatch==='no encontrado').length,
  zeroAfter:colonies.filter(item=>item.cp==='00000').length,
  byState:Object.fromEntries(['08','32'].map(state=>[state,{
    before:rawColonies.filter(item=>item.state===state&&String(item.cp||'').padStart(5,'0')==='00000').length,
    corrected:colonies.filter(item=>item.state===state&&item.cpSource==='Correos de México').length,
    after:colonies.filter(item=>item.state===state&&item.cp==='00000').length
  }]))
};
fs.writeFileSync('public/geo-colonias-regional.json',JSON.stringify({crs:'WGS_1984_UTM_Zone_13N',bbox:bounds,meta:{source:'INEGI 2025 + Catálogo Nacional de Códigos Postales 10/08/2026',states:['08','32'],features:colonies.length,postalStats},features:colonies}));
fs.writeFileSync('public/geo-boundaries-regional.json',JSON.stringify(regionalBoundaries));
fs.writeFileSync('public/geo-streets-regional.json',JSON.stringify({meta:{source:'Chihuahua + INEGI 2025 Zacatecas',features:currentStreets.roads.length+zacatecasRoads.length,zacatecasMunicipalities:['Fresnillo','Zacatecas'],zacatecasFeatures:zacatecasRoads.length},roads:[...currentStreets.roads,...zacatecasRoads]}));
console.log(JSON.stringify({colonies:colonies.length,chihuahua:colonies.filter(item=>item.state==='08').length,zacatecas:colonies.filter(item=>item.state==='32').length,municipalities:regionalBoundaries.municipalities.length,urban:regionalBoundaries.urban.length,agebs:regionalBoundaries.agebs.length,roads:currentStreets.roads.length+zacatecasRoads.length,zacatecasRoads:zacatecasRoads.length,zacatecasRoadMunicipalities:[...servedZacatecasCodes].map(code=>zacMunicipalityNames.get(code)),postalStats,bbox:bounds},null,2));
