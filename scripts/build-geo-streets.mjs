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
  attributes.push(wanted.has(municipality)&&name?{name,type:readField(typeField,index).trim(),municipality}:null);
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
    if(lines.length)roads.push({n:attr.name,t:attr.type,m:attr.municipality,l:lines});
  }
  offset=start+contentBytes;
  index++;
}
fs.writeFileSync('public/geo-streets-chihuahua.json',JSON.stringify({meta:{source:'VIALIDAD_EDO_190121',features:roads.length},roads}));
console.log(`Generated ${roads.length} road features.`);
