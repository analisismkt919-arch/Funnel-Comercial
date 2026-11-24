const vehicleRows = [
  ['CHEVROLET','Aveo'], ['CHEVROLET','Onix'], ['CHEVROLET','Tracker'], ['CHEVROLET','Captiva'], ['CHEVROLET','Groove'],
  ['CHEVROLET','S10 Max'], ['CHEVROLET','Colorado'], ['CHEVROLET','Silverado'], ['CHEVROLET','Tahoe'], ['CHEVROLET','Suburban'],
  ['GMC','Terrain'], ['GMC','Acadia'], ['GMC','Sierra'], ['GMC','Yukon'],
  ['BUICK','Envista'], ['BUICK','Encore GX'], ['BUICK','Envision'],
  ['CADILLAC','XT4'], ['CADILLAC','XT5'], ['CADILLAC','Escalade'],
];

export const CHECKIN_SOURCE_OPTIONS = ['Piso', 'Calle', 'Fan Page', 'Reactivaciones', 'Llamadas'];

export const CHECKIN_DEFAULT_VEHICLES = vehicleRows.map(([brand, name], index) => ({
  id:`base-vehicle-${index + 1}`, brand, name, active:true, system:true
}));

const detailRows = [
  ['Piso','Fresh Up'], ['Piso','Cita'], ['Piso','Be-back'],
  ['Calle','Plaza comercial'], ['Calle','Evento'], ['Calle','Cruce / calle'],
  ['Fan Page','Facebook'], ['Fan Page','Instagram'], ['Fan Page','WhatsApp'],
  ['Reactivaciones','Base histórica'], ['Llamadas','Prospección telefónica'],
];

export const CHECKIN_DEFAULT_SOURCE_DETAILS = detailRows.map(([source, name], index) => ({
  id:`base-detail-${index + 1}`, source, name, active:true, system:true
}));

const normalize = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

export function mergeCheckInCatalog(defaults = [], saved = [], fields = ['brand','name']) {
  const map = new Map();
  [...defaults, ...(Array.isArray(saved) ? saved : [])].forEach(item => {
    const key = fields.map(field => normalize(item?.[field])).join('|');
    if (!key.replace(/\|/g,'')) return;
    const previous = map.get(key);
    map.set(key, { ...previous, ...item, id:item?.id || previous?.id || `catalog-${map.size + 1}`, active:item?.active !== false });
  });
  return [...map.values()];
}
