import fs from 'node:fs';

const source = '.tmp-shapes/Shapes/VIALIDAD_EDO_190121';
const dbf = fs.readFileSync(`${source}.dbf`);
const shp = fs.readFileSync(`${source}.shp`);
const wanted = new Set(['CHIHUAHUA','DELICIAS','CUAUHTEMOC','HIDALGO DEL PARRAL','CAMARGO','JIMENEZ','OJINAGA']);
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const headerLength = dbf.readUInt16LE(8);
const recordLength = dbf.readUInt16LE(10);
const fields=[];
let fieldOffset=1;
for(let offset=32;dbf[offset]!==13;offset+=32){
  const name=dbf.subarray(offset,offset+11).toString('latin1').replace(/\0.*$/,'');
  const length=dbf[offset+16];
  fields.push({name,offset:fieldOffset,length});
  fieldOffset+=length;
}
const field=name=>fields.find(item=>item.name===name);
const nameField=field('NOMVIAL'),typeField=field('TIPOVIAL'),municipalityField=field('MUNICIPIO');
const readField=(record,index)=>dbf.subarray(headerLength+index*recordLength+record.offset,headerLength+index*recordLength+record.offset+record.length).toString('latin1').trim();
const attributes=[];
const count=dbf.readUInt32LE(4);
for(let index=0;index<count;index++){
  const municipality=normalize(readField(municipalityField,index));
  const name=readField(nameField,index).trim();
  const type=readField(typeField,index).trim();
  const roadKind=normalize(`${type} ${name}`);
  const isHighway=/CARRETERA|AUTOPISTA|LIBRAMIENTO|PERIFERICO|CORREDOR|SUPER CARRETERA/.test(roadKind);
  attributes.push(name&&(wanted.has(municipality)||isHighway)?{name,type,municipality,isHighway}:null);
}
const roads=[];
let offset=100,index=0;
while(offset+8<=shp.length&&index<attributes.length){
  const contentBytes=shp.readUInt32BE(offset+4)*2;
  const start=offset+8;
  const shapeType=shp.readUInt32LE(start);
  const attr=attributes[index];
  if(attr&&(shapeType===3||shapeType===5)){
    const partCount=shp.readUInt32LE(start+36),pointCount=shp.readUInt32LE(start+40);
    const parts=Array.from({length:partCount},(_,part)=>shp.readUInt32LE(start+44+part*4));
    const pointsStart=start+44+partCount*4;
    const lines=[];
    for(let part=0;part<partCount;part++){
      const from=parts[part],to=part+1<partCount?parts[part+1]:pointCount,line=[];
      for(let point=from;point<to;point++){
        if(point!==from&&point!==to-1&&(point-from)%3!==0)continue;
        line.push([Math.round(shp.readDoubleLE(pointsStart+point*16)),Math.round(shp.readDoubleLE(pointsStart+point*16+8))]);
      }
      if(line.length>1)lines.push(line);
    }
    if(lines.length)roads.push({n:attr.name,t:attr.type,m:attr.municipality,h:attr.isHighway?1:0,l:lines});
  }
  offset=start+contentBytes;
  index++;
}
// La red carretera viene en Lambert Conformal Conic (ITRF92); el mapa web usa
// WGS84 / UTM 13N. Se transforma aquí para conservar todos los tramos estatales.
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
const appendStateHighways=()=>{
  const base='.tmp-shapes/Shapes/Carreteras',roadDbf=fs.readFileSync(`${base}.dbf`),roadShp=fs.readFileSync(`${base}.shp`);
  const roadHeader=roadDbf.readUInt16LE(8),roadLength=roadDbf.readUInt16LE(10),roadCount=roadDbf.readUInt32LE(4),roadFields=[];let accumulated=1;
  for(let fieldOffset=32;roadDbf[fieldOffset]!==13;fieldOffset+=32){const fieldName=roadDbf.subarray(fieldOffset,fieldOffset+11).toString('latin1').replace(/\0.*$/,''),length=roadDbf[fieldOffset+16];roadFields.push({name:fieldName,offset:accumulated,length});accumulated+=length;}
  const value=(fieldName,row)=>{const item=roadFields.find(field=>field.name===fieldName);return item?roadDbf.subarray(roadHeader+row*roadLength+item.offset,roadHeader+row*roadLength+item.offset+item.length).toString('latin1').trim():'';};
  let shapeOffset=100,row=0,added=0;
  while(shapeOffset+8<=roadShp.length&&row<roadCount){const contentBytes=roadShp.readUInt32BE(shapeOffset+4)*2,start=shapeOffset+8,shapeType=roadShp.readUInt32LE(start);if(shapeType===3||shapeType===5){const partCount=roadShp.readUInt32LE(start+36),pointCount=roadShp.readUInt32LE(start+40),parts=Array.from({length:partCount},(_,part)=>roadShp.readUInt32LE(start+44+part*4)),pointsStart=start+44+partCount*4,lines=[];for(let part=0;part<partCount;part++){const from=parts[part],to=part+1<partCount?parts[part+1]:pointCount,line=[];for(let point=from;point<to;point++){if(point!==from&&point!==to-1&&(point-from)%3!==0)continue;const projected=lonLatToUtm13(lccToLonLat(roadShp.readDoubleLE(pointsStart+point*16),roadShp.readDoubleLE(pointsStart+point*16+8)));line.push(projected.map(value=>Math.round(value)));}if(line.length>1)lines.push(line);}if(lines.length){const number=value('NUMERO',row),name=number&&!/^NINGUNO$/i.test(number)?`Carretera ${number}`:`Carretera ${row+1}`;roads.push({n:name,t:value('TIPO',row)||'Carretera',m:'CHIHUAHUA',h:1,l:lines});added++;}}shapeOffset=start+contentBytes;row++;}
  return added;
};
const stateHighways=appendStateHighways();
fs.writeFileSync('public/geo-streets-chihuahua.json',JSON.stringify({meta:{source:'VIALIDAD_EDO_190121 + Carreteras',features:roads.length,stateHighways,scope:'local streets in served municipalities plus complete statewide highway network'},roads}));
console.log(`Generated ${roads.length} road features, including ${stateHighways} statewide highway segments.`);
