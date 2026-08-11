import fs from 'node:fs';

const ROOT='.tmp-shapes-new';
const currentBoundaries=JSON.parse(fs.readFileSync('public/geo-boundaries-chihuahua.json','utf8'));
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
const readShapes=(path,{transform=true,simplify=true}={})=>{
  const shp=fs.readFileSync(path),shapes=[];let offset=100;
  while(offset+8<=shp.length){const contentBytes=shp.readUInt32BE(offset+4)*2,start=offset+8,type=shp.readUInt32LE(start);let rings=[];
    if(type===5||type===3){const partCount=shp.readUInt32LE(start+36),pointCount=shp.readUInt32LE(start+40),parts=Array.from({length:partCount},(_,part)=>shp.readUInt32LE(start+44+part*4)),pointsStart=start+44+partCount*4;
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
  const records=readDbf(`${base}.dbf`),shapes=readShapes(`${base}.shp`);
  return records.flatMap((record,index)=>{const rings=shapes[index];if(!rings?.length)return[];return[{id:`${state}-${record.cvegeo||index}`,state,cp:record.cp,colonia:record.nom_asen,municipio:state==='08'?(chihuahuaMunicipality(ringCenter(rings))||chihuahuaFallbackMunicipalities.get(record.cve_mun)||''):(zacMunicipalityNames.get(record.cve_mun)||''),localidad:'',tipo:record.tipo,actualizacion:record.fecha_act,rings}];});
};
const colonies=[
  ...buildColonies('08',`${ROOT}/chihuahua/conjunto_de_datos/08as`),
  ...buildColonies('32',`${ROOT}/zacatecas-colonias/conjunto_de_datos/32as`)
];
const bounds=colonies.flatMap(feature=>feature.rings.flat()).reduce((bbox,point)=>[Math.min(bbox[0],point[0]),Math.min(bbox[1],point[1]),Math.max(bbox[2],point[0]),Math.max(bbox[3],point[1])],[Infinity,Infinity,-Infinity,-Infinity]);
const municipalityFeatures=zacMunicipalityRecords.map((record,index)=>({id:`32-${record.CVE_MUN}`,state:'32',name:record.NOMGEO,rings:zacMunicipalityShapes[index]})).filter(feature=>feature.rings.length);
const localityRecords=readDbf(`${ROOT}/zacatecas-marco/conjunto_de_datos/32l.dbf`),localityShapes=readShapes(`${ROOT}/zacatecas-marco/conjunto_de_datos/32l.shp`);
const urbanFeatures=localityRecords.map((record,index)=>({id:`32-${record.CVE_MUN}-${record.CVE_LOC}`,state:'32',name:record.NOMGEO,scope:record.AMBITO,rings:localityShapes[index]})).filter(feature=>feature.rings.length&&/URBAN/i.test(feature.scope));
const agebRecords=readDbf(`${ROOT}/zacatecas-marco/conjunto_de_datos/32a.dbf`),agebShapes=readShapes(`${ROOT}/zacatecas-marco/conjunto_de_datos/32a.shp`);
const agebFeatures=agebRecords.map((record,index)=>({id:`32-${record.CVEGEO}`,state:'32',rings:agebShapes[index]})).filter(feature=>feature.rings.length);

const regionalBoundaries={
  crs:'WGS_1984_UTM_Zone_13N',
  municipalities:[...currentBoundaries.municipalities.map(feature=>({...feature,state:'08'})),...municipalityFeatures],
  urban:[...currentBoundaries.urban.map(feature=>({...feature,state:'08'})),...urbanFeatures],
  agebs:[...currentBoundaries.agebs.map(feature=>({...feature,state:'08'})),...agebFeatures],
  meta:{source:'INEGI 2025 · Chihuahua y Zacatecas',states:['08','32'],municipalities:currentBoundaries.municipalities.length+municipalityFeatures.length,urban:currentBoundaries.urban.length+urbanFeatures.length,agebs:currentBoundaries.agebs.length+agebFeatures.length}
};
fs.writeFileSync('public/geo-colonias-regional.json',JSON.stringify({crs:'WGS_1984_UTM_Zone_13N',bbox:bounds,meta:{source:'INEGI 2025',states:['08','32'],features:colonies.length},features:colonies}));
fs.writeFileSync('public/geo-boundaries-regional.json',JSON.stringify(regionalBoundaries));
console.log(JSON.stringify({colonies:colonies.length,chihuahua:colonies.filter(item=>item.state==='08').length,zacatecas:colonies.filter(item=>item.state==='32').length,municipalities:regionalBoundaries.municipalities.length,urban:regionalBoundaries.urban.length,agebs:regionalBoundaries.agebs.length,bbox:bounds},null,2));
