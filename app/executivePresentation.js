const COLORS = {
  navy: '102B57', blue: '245BC4', royal: '2563EB', cyan: '16A9DF', sky: '7DD3FC',
  ink: '10213D', slate: '53657D', muted: '7B8DA6', line: 'D9E4F2', bg: 'F4F7FB',
  white: 'FFFFFF', green: '16A34A', greenBg: 'ECFDF5', amber: 'D97706', amberBg: 'FFF7E6',
  red: 'DC2626', redBg: 'FEF2F2', teal: '0F8FA8', darkTeal: '0E5D6B',
};

const fmt = value => Number(value || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
const pct = value => `${(Number(value || 0) * 100).toFixed(1)}%`;
const signedPct = value => value == null ? 'Sin base' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
const signedPp = value => value == null ? 'Sin base' : `${value >= 0 ? '+' : ''}${value.toFixed(2)} pp`;
const clean = value => String(value ?? '').trim();
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function addHeader(pptx, slide, title, kicker, model, page) {
  slide.background = { color: COLORS.bg };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .68, fill: { color: COLORS.navy }, line: { color: COLORS.navy } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: .68, w: 13.333, h: .055, fill: { color: COLORS.cyan }, line: { color: COLORS.cyan } });
  slide.addShape(pptx.ShapeType.roundRect, { x: .23, y: .08, w: 2.7, h: .5, rectRadius: .04, fill: { color: COLORS.white }, line: { color: 'DCE9FA', transparency: 100 } });
  slide.addImage({ path: model.logoDrive, x: .34, y: .12, w: .77, h: .4, transparency: 0 });
  slide.addImage({ data: model.logoBrands, x: 1.28, y: .19, w: 1.52, h: .25 });
  slide.addText(clean(kicker).toUpperCase(), { x: 3.14, y: .12, w: 3.3, h: .16, fontFace: 'Aptos', fontSize: 7.5, bold: true, color: COLORS.sky, charSpacing: 1.1, margin: 0 });
  slide.addText(title, { x: 3.14, y: .3, w: 9.55, h: .24, fontFace: 'Aptos Display', fontSize: 18, bold: true, color: COLORS.white, margin: 0, breakLine: false, fit: 'shrink' });
  slide.addText(model.scopeLabel, { x: .42, y: 7.19, w: 10.7, h: .12, fontFace: 'Aptos', fontSize: 6.5, color: COLORS.muted, margin: 0 });
  slide.addText(String(page), { x: 12.45, y: 7.17, w: .42, h: .14, fontFace: 'Aptos', fontSize: 7, bold: true, color: COLORS.muted, align: 'right', margin: 0 });
}

function addTitle(slide, title, subtitle = '') {
  slide.addText(title, { x: .48, y: .93, w: 12.25, h: .38, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: COLORS.ink, margin: 0, fit: 'shrink' });
  if (subtitle) slide.addText(subtitle, { x: .5, y: 1.36, w: 12.1, h: .32, fontFace: 'Aptos', fontSize: 10.5, color: COLORS.slate, margin: 0, fit: 'shrink' });
}

function addCard(pptx, slide, { x, y, w, h, label, value, detail, color = COLORS.blue, fill = COLORS.white }) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: .06, fill: { color: fill }, line: { color: COLORS.line, width: 1 } });
  slide.addShape(pptx.ShapeType.rect, { x, y, w, h: .065, fill: { color }, line: { color } });
  slide.addText(clean(label).toUpperCase(), { x: x + .18, y: y + .18, w: w - .36, h: .16, fontFace: 'Aptos', fontSize: 7.5, bold: true, color: COLORS.muted, charSpacing: .5, margin: 0, fit: 'shrink' });
  slide.addText(clean(value), { x: x + .18, y: y + .44, w: w - .36, h: .46, fontFace: 'Aptos Display', fontSize: 23, bold: true, color: COLORS.ink, margin: 0, fit: 'shrink' });
  if (detail) slide.addText(clean(detail), { x: x + .18, y: y + h - .38, w: w - .36, h: .2, fontFace: 'Aptos', fontSize: 8, color: COLORS.slate, margin: 0, fit: 'shrink' });
}

function addInsight(pptx, slide, text, { x = .5, y = 6.45, w = 12.25, color = COLORS.blue } = {}) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: .48, rectRadius: .05, fill: { color: 'EEF5FF' }, line: { color: 'BFD6FA', width: .8 } });
  slide.addText('LECTURA EJECUTIVA', { x: x + .18, y: y + .1, w: 1.35, h: .12, fontFace: 'Aptos', fontSize: 6.7, bold: true, color, charSpacing: .5, margin: 0 });
  slide.addText(clean(text), { x: x + 1.62, y: y + .08, w: w - 1.82, h: .3, fontFace: 'Aptos', fontSize: 9.2, color: COLORS.ink, margin: 0, fit: 'shrink', valign: 'middle' });
}

function addSectionSlide(pptx, slide, model, page, number, title, subtitle) {
  slide.background = { color: COLORS.navy };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 6.9, w: 13.333, h: .6, fill: { color: COLORS.cyan }, line: { color: COLORS.cyan } });
  slide.addShape(pptx.ShapeType.roundRect, { x: .56, y: .45, w: 3.72, h: .82, rectRadius: .06, fill: { color: COLORS.white }, line: { color: COLORS.white } });
  slide.addImage({ path: model.logoDrive, x: .68, y: .56, w: 1.1, h: .58 });
  slide.addImage({ data: model.logoBrands, x: 2.08, y: .7, w: 2.0, h: .33 });
  slide.addText(String(number).padStart(2, '0'), { x: .75, y: 2.02, w: 1.25, h: 1.15, fontFace: 'Aptos Display', fontSize: 60, bold: true, color: COLORS.sky, margin: 0 });
  slide.addText(title, { x: 2.15, y: 2.17, w: 9.8, h: .72, fontFace: 'Aptos Display', fontSize: 36, bold: true, color: COLORS.white, margin: 0, fit: 'shrink' });
  slide.addText(subtitle, { x: 2.18, y: 3.08, w: 9.5, h: .7, fontFace: 'Aptos', fontSize: 16, color: 'DCE9FA', margin: 0, fit: 'shrink' });
  slide.addText(`${model.scopeLabel} · ${page}`, { x: 2.18, y: 5.92, w: 9.5, h: .2, fontFace: 'Aptos', fontSize: 8, color: 'AFC4DF', margin: 0 });
}

function addBulletList(pptx, slide, items, { x = .65, y = 1.8, w = 12, h = 4.9, accent = COLORS.blue, fontSize = 15 } = {}) {
  const safe = items.filter(Boolean).slice(0, 7);
  const rowH = h / Math.max(safe.length, 1);
  safe.forEach((item, index) => {
    const top = y + index * rowH;
    slide.addShape(pptx.ShapeType.ellipse, { x, y: top + .11, w: .2, h: .2, fill: { color: item.color || accent }, line: { color: item.color || accent } });
    slide.addText(clean(item.title || item), { x: x + .34, y: top, w: 3.15, h: .32, fontFace: 'Aptos Display', fontSize: fontSize - 1, bold: true, color: COLORS.ink, margin: 0, fit: 'shrink' });
    slide.addText(clean(item.detail || ''), { x: x + 3.65, y: top, w: w - 4.0, h: .44, fontFace: 'Aptos', fontSize: fontSize - 4, color: COLORS.slate, margin: 0, fit: 'shrink', valign: 'middle' });
    if (index < safe.length - 1) slide.addShape(pptx.ShapeType.line, { x: x + .34, y: top + rowH - .08, w: w - .34, h: 0, line: { color: COLORS.line, width: .6 } });
  });
}

function addBarChart(pptx, slide, rows, { x, y, w, h, name = 'Valor', color = COLORS.blue, percentage = false, max = null }) {
  if (!rows.length) return;
  slide.addChart(pptx.ChartType.bar, [{ name, labels: rows.map(row => row.label), values: rows.map(row => finite(row.value)) }], {
    x, y, w, h, catAxisLabelFontFace: 'Aptos', catAxisLabelFontSize: 9,
    valAxisLabelFontFace: 'Aptos', valAxisLabelFontSize: 8, showLegend: false, showTitle: false,
    showValue: true, showCatName: false, dataLabelPosition: 'outEnd', dataLabelColor: COLORS.ink,
    dataLabelFormatCode: percentage ? '0.0%' : '#,##0', chartColors: [color],
    showValue: true, showCategoryName: false, showGridLines: true,
    valGridLine: { color: 'DDE6F2', width: .7 }, showCatName: false,
    valAxisMinVal: percentage ? 0 : undefined, valAxisMaxVal: max ?? undefined,
    showValue: true, gapWidthPct: 45, border: { color: 'C8D7E8', pt: .5 },
  });
}

function addLineChart(pptx, slide, series, { x, y, w, h, percentage = false }) {
  const valid = series.filter(item => item.values?.some(value => value != null));
  if (!valid.length) return;
  slide.addChart(pptx.ChartType.line, valid.map(item => ({ name: item.name, labels: item.labels, values: item.values.map(value => value == null ? 0 : finite(value)) })), {
    x, y, w, h, showLegend: true, legendPos: 'b', legendFontFace: 'Aptos', legendFontSize: 8,
    catAxisLabelFontFace: 'Aptos', catAxisLabelFontSize: 8, valAxisLabelFontFace: 'Aptos', valAxisLabelFontSize: 8,
    showTitle: false, showValue: false, showGridLines: true, valGridLine: { color: 'DDE6F2', width: .7 },
    chartColors: [COLORS.blue, COLORS.cyan, COLORS.green, COLORS.amber], lineSize: 2.5,
    valAxisMinVal: percentage ? 0 : undefined, valAxisLabelFormatCode: percentage ? '0%' : '#,##0',
    showMarker: true, markerSize: 5, border: { color: 'C8D7E8', pt: .5 },
  });
}

function tableOptions(widths, rowH = .32) {
  return {
    x: .55, y: 1.72, w: 12.2, h: 4.85,
    border: { type: 'solid', color: COLORS.line, pt: .7 },
    fill: COLORS.white, color: COLORS.ink, fontFace: 'Aptos', fontSize: 9,
    margin: .07, rowH, colW: widths, valign: 'middle',
    autoFit: false, autoPage: false, breakLine: false,
  };
}

export async function buildExecutivePresentation(model, onProgress = () => {}) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'CR3 Drive Intelligence 360';
  pptx.company = 'Grupo CR3';
  pptx.subject = 'Presentación ejecutiva automática';
  pptx.title = `CR3 Drive Intelligence 360 · ${model.periodLabel}`;
  pptx.lang = 'es-MX';
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'es-MX' };
  pptx.defineSlideMaster({
    title: 'CR3_MASTER',
    background: { color: COLORS.bg },
    objects: [],
  });
  let page = 0;
  const slide = (title, kicker, subtitle = '') => {
    page += 1;
    const result = pptx.addSlide('CR3_MASTER');
    addHeader(pptx, result, title, kicker, model, page);
    addTitle(result, title, subtitle);
    return result;
  };
  const section = (number, title, subtitle) => {
    page += 1;
    const result = pptx.addSlide();
    addSectionSlide(pptx, result, model, page, number, title, subtitle);
    return result;
  };

  onProgress({ stage: 'Preparando narrativa ejecutiva', percent: 10 });
  page += 1;
  const cover = pptx.addSlide();
  cover.background = { color: COLORS.navy };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 6.82, w: 13.333, h: .68, fill: { color: COLORS.cyan }, line: { color: COLORS.cyan } });
  cover.addShape(pptx.ShapeType.roundRect, { x: .58, y: .44, w: 3.88, h: .9, rectRadius: .06, fill: { color: COLORS.white }, line: { color: COLORS.white } });
  cover.addImage({ path: model.logoDrive, x: .75, y: .58, w: 1.18, h: .62 });
  cover.addImage({ data: model.logoBrands, x: 2.22, y: .73, w: 2.08, h: .34 });
  cover.addText('CR3 DRIVE INTELLIGENCE 360', { x: .82, y: 1.78, w: 11.7, h: .36, fontFace: 'Aptos', fontSize: 14, bold: true, color: COLORS.sky, charSpacing: 2.2, margin: 0 });
  cover.addText(model.coverTitle || 'LECTURA EJECUTIVA INTEGRADA DEL NEGOCIO', { x: .82, y: 2.32, w: 11.65, h: 1.18, fontFace: 'Aptos Display', fontSize: 35, bold: true, color: COLORS.white, margin: 0, fit: 'shrink' });
  cover.addText(`${model.periodLabel} · ${model.branchLabel} · ${model.brandLabel}`, { x: .84, y: 3.78, w: 10.7, h: .42, fontFace: 'Aptos', fontSize: 18, bold: true, color: COLORS.white, margin: 0, fit: 'shrink' });
  cover.addText('Decisiones comerciales sustentadas en Industria, AMDA, operación interna y GeoInteligencia.', { x: .84, y: 4.48, w: 10.85, h: .48, fontFace: 'Aptos', fontSize: 13, color: 'DCE9FA', margin: 0 });
  cover.addText(`Generada el ${model.generatedLabel}`, { x: .84, y: 5.4, w: 5, h: .2, fontFace: 'Aptos', fontSize: 8.5, color: 'AFC4DF', margin: 0 });

  let s = slide(model.executiveTitle, 'Resumen ejecutivo', 'La lectura combina resultado, tendencia, posición competitiva, palancas operativas y territorio.');
  const cards = model.snapshot.slice(0, 6);
  cards.forEach((card, index) => addCard(pptx, s, { x: .52 + (index % 3) * 4.13, y: 1.88 + Math.floor(index / 3) * 1.86, w: 3.85, h: 1.55, ...card }));
  addInsight(pptx, s, model.executiveSummary, { y: 5.78 });

  s = slide('Las cinco decisiones que requieren atención directiva', 'Prioridades', 'Cada punto conecta evidencia, efecto comercial y una decisión concreta.');
  addBulletList(pptx, s, model.topFindings, { y: 1.78, h: 4.95, fontSize: 14 });

  section(1, 'Mercado y posición competitiva', 'Qué está pasando fuera del grupo y dónde existe espacio para capturar participación.');
  onProgress({ stage: 'Integrando Industria y AMDA', percent: 30 });

  s = slide(model.industry.title, 'Industria nacional · INEGI', model.industry.subtitle);
  if (model.industry.available) {
    addCard(pptx, s, { x: .52, y: 1.82, w: 2.75, h: 1.42, label: 'Mercado nacional', value: fmt(model.industry.market), detail: `Vs periodo ${signedPct(model.industry.periodGrowth)}` });
    addCard(pptx, s, { x: 3.45, y: 1.82, w: 2.75, h: 1.42, label: model.industry.brandLabel, value: fmt(model.industry.brandUnits), detail: `Vs año ${signedPct(model.industry.annualGrowth)}`, color: COLORS.green });
    addCard(pptx, s, { x: 6.38, y: 1.82, w: 2.75, h: 1.42, label: 'Participación', value: pct(model.industry.share), detail: `Cambio anual ${signedPp(model.industry.annualPp)}`, color: COLORS.cyan });
    addCard(pptx, s, { x: 9.31, y: 1.82, w: 3.4, h: 1.42, label: 'Marca líder', value: model.industry.leader || '—', detail: model.industry.leaderShare != null ? pct(model.industry.leaderShare) : '', color: COLORS.amber });
    addLineChart(pptx, s, model.industry.series, { x: .58, y: 3.46, w: 7.55, h: 2.45 });
    addBarChart(pptx, s, model.industry.ranking.slice(0, 8), { x: 8.37, y: 3.44, w: 4.2, h: 2.48, name: 'Participación', color: COLORS.blue, percentage: true });
    addInsight(pptx, s, model.industry.insight, { y: 6.12 });
  } else addBulletList(pptx, s, [{ title: 'Información no disponible', detail: model.industry.unavailableReason }], { y: 2.2, h: 1.3 });

  s = slide(model.amda.title, 'AMDA Chihuahua', model.amda.subtitle);
  if (model.amda.available) {
    addCard(pptx, s, { x: .52, y: 1.82, w: 2.9, h: 1.42, label: 'Mercado estatal', value: fmt(model.amda.market), detail: model.amda.category });
    addCard(pptx, s, { x: 3.62, y: 1.82, w: 2.9, h: 1.42, label: 'Unidades seleccionadas', value: fmt(model.amda.selectedUnits), detail: model.amda.brandLabel, color: COLORS.green });
    addCard(pptx, s, { x: 6.72, y: 1.82, w: 2.9, h: 1.42, label: 'Participación estatal', value: pct(model.amda.share), detail: `Cambio anual ${signedPp(model.amda.annualPp)}`, color: COLORS.cyan });
    addCard(pptx, s, { x: 9.82, y: 1.82, w: 2.9, h: 1.42, label: 'Agencia líder', value: model.amda.leadingAgency || '—', detail: `${fmt(model.amda.leadingAgencyUnits)} unidades`, color: COLORS.amber });
    addBarChart(pptx, s, model.amda.brandRanking.slice(0, 10), { x: .58, y: 3.46, w: 5.9, h: 2.52, name: 'Participación', percentage: true, color: COLORS.teal });
    addBarChart(pptx, s, model.amda.agencyRanking.slice(0, 10), { x: 6.75, y: 3.46, w: 5.82, h: 2.52, name: 'Unidades', color: COLORS.blue });
    addInsight(pptx, s, model.amda.insight, { y: 6.16 });
  } else addBulletList(pptx, s, [{ title: 'Información no disponible', detail: model.amda.unavailableReason }], { y: 2.2, h: 1.3 });

  section(2, 'Desempeño comercial interno', 'Cómo se traduce el mercado en actividad, conversión, venta y entrega dentro de la red.');
  onProgress({ stage: 'Analizando desempeño y funnel', percent: 50 });

  s = slide(model.performance.title, 'Resultado interno', model.performance.subtitle);
  model.performance.cards.forEach((card, index) => addCard(pptx, s, { x: .52 + index * 2.5, y: 1.82, w: 2.28, h: 1.42, ...card }));
  addLineChart(pptx, s, model.performance.series, { x: .58, y: 3.48, w: 7.5, h: 2.53 });
  addBarChart(pptx, s, model.performance.branchRanking.slice(0, 10), { x: 8.34, y: 3.46, w: 4.25, h: 2.55, name: 'Ventas', color: COLORS.blue });
  addInsight(pptx, s, model.performance.insight, { y: 6.17 });

  s = slide(model.funnel.title, 'Funnel comercial', model.funnel.subtitle);
  const funnelRows = [
    [{ text: 'ETAPA', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'VOLUMEN', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'CONVERSIÓN', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'VS META', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }],
    ...model.funnel.rows.map((row, index) => [
      { text: row.label, options: { bold: true, color: COLORS.ink, fill: index % 2 ? 'F7FAFE' : COLORS.white } },
      { text: fmt(row.value), options: { bold: true, color: COLORS.blue, fill: index % 2 ? 'F7FAFE' : COLORS.white, align: 'right' } },
      { text: row.conversion == null ? 'Base' : pct(row.conversion), options: { color: COLORS.ink, fill: index % 2 ? 'F7FAFE' : COLORS.white, align: 'right' } },
      { text: row.vsTarget == null ? 'Sin meta' : signedPp(row.vsTarget), options: { bold: true, color: row.vsTarget >= 0 ? COLORS.green : COLORS.red, fill: index % 2 ? 'F7FAFE' : COLORS.white, align: 'right' } },
    ]),
  ];
  s.addTable(funnelRows, { ...tableOptions([2.55, 1.15, 1.25, 1.25], .46), x: .58, y: 1.82, w: 6.2, h: 4.45, fontSize: 10.5, margin: .09 });
  addBarChart(pptx, s, model.funnel.rows.map(row => ({ label: row.label, value: row.value })), { x: 7.12, y: 1.88, w: 5.35, h: 4.05, name: 'Registros', color: COLORS.cyan });
  addInsight(pptx, s, model.funnel.insight, { y: 6.22 });

  s = slide(model.drivers.title, 'Equipos y sucursales', model.drivers.subtitle);
  addBarChart(pptx, s, model.drivers.branches.slice(0, 10), { x: .58, y: 1.82, w: 6.05, h: 3.6, name: 'Ventas', color: COLORS.green });
  addBarChart(pptx, s, model.drivers.apvs.slice(0, 10), { x: 6.83, y: 1.82, w: 5.75, h: 3.6, name: 'Registros cerrados', color: COLORS.blue });
  addBulletList(pptx, s, model.drivers.notes, { x: .66, y: 5.6, w: 11.8, h: .78, fontSize: 11 });
  addInsight(pptx, s, model.drivers.insight, { y: 6.32 });

  s = slide(model.blockers.title, 'Bloqueos y fugas', model.blockers.subtitle);
  addBulletList(pptx, s, model.blockers.items, { x: .65, y: 1.8, w: 12, h: 4.95, accent: COLORS.red, fontSize: 14 });

  section(3, 'Territorio y demanda', 'Dónde se concentra la venta y qué zonas justifican acciones comerciales específicas.');
  onProgress({ stage: 'Integrando GeoInteligencia', percent: 68 });

  s = slide(model.geo.title, 'GeoInteligencia', model.geo.subtitle);
  if (model.geo.available) {
    addCard(pptx, s, { x: .52, y: 1.82, w: 2.75, h: 1.42, label: 'Ventas georreferenciadas', value: fmt(model.geo.sales), detail: `${model.geo.postalCodes} códigos postales` });
    addCard(pptx, s, { x: 3.47, y: 1.82, w: 2.75, h: 1.42, label: 'Zona líder', value: model.geo.leadingPostalCode || '—', detail: `${fmt(model.geo.leadingSales)} ventas`, color: COLORS.cyan });
    addCard(pptx, s, { x: 6.42, y: 1.82, w: 2.75, h: 1.42, label: 'Concentración Top 5', value: pct(model.geo.top5Share), detail: 'Participación territorial', color: COLORS.amber });
    addCard(pptx, s, { x: 9.37, y: 1.82, w: 3.35, h: 1.42, label: 'Sucursal territorial líder', value: model.geo.leadingBranch || '—', detail: `${fmt(model.geo.leadingBranchSales)} ventas`, color: COLORS.green });
    addBarChart(pptx, s, model.geo.ranking.slice(0, 12), { x: .58, y: 3.5, w: 6.1, h: 2.45, name: 'Ventas', color: COLORS.blue });
    addBarChart(pptx, s, model.geo.colonies.slice(0, 12), { x: 6.9, y: 3.5, w: 5.68, h: 2.45, name: 'Ventas', color: COLORS.teal });
    addInsight(pptx, s, model.geo.insight, { y: 6.14 });
  } else addBulletList(pptx, s, [{ title: 'Información no disponible', detail: model.geo.unavailableReason }], { y: 2.2, h: 1.3 });

  s = slide(model.geoPriorities.title, 'Prioridades geográficas', model.geoPriorities.subtitle);
  if (model.geo.available) {
    const geoRows = [
      [{ text: '#', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'CP / ZONA', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'COLONIA / MUNICIPIO', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'VENTAS', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'PART.', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'SUCURSAL LÍDER', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }],
      ...model.geo.ranking.slice(0, 12).map((row, index) => [String(index + 1), row.label, row.detail || '—', fmt(row.value), pct(row.share), row.branch || '—']),
    ];
    s.addTable(geoRows, { ...tableOptions([.55, 1.45, 4.15, 1.25, 1.1, 3.7], .37), x: .58, y: 1.78, w: 12.15, h: 4.9, fontSize: 9.5 });
    addInsight(pptx, s, model.geoPriorities.insight, { y: 6.28 });
  } else addBulletList(pptx, s, [{ title: 'Sin base territorial', detail: model.geo.unavailableReason }], { y: 2.2, h: 1.3 });

  section(4, 'Decisiones y plan de acción', 'Convertir hallazgos en prioridades, responsables, indicadores y cadencia de seguimiento.');
  onProgress({ stage: 'Construyendo recomendaciones', percent: 82 });

  s = slide('La lectura cruzada revela oportunidades que ningún módulo muestra por separado', 'Hallazgos integrados', 'Relaciones causales e hipótesis sustentadas en los datos disponibles.');
  addBulletList(pptx, s, model.crossInsights, { y: 1.78, h: 4.98, accent: COLORS.teal, fontSize: 14 });

  s = slide('Oportunidades con potencial de impacto medible', 'Oportunidades', 'Priorizadas por magnitud, urgencia y capacidad de ejecución.');
  addBulletList(pptx, s, model.opportunities, { y: 1.78, h: 4.98, accent: COLORS.green, fontSize: 14 });

  s = slide('Riesgos que pueden frenar el resultado del periodo', 'Riesgos', 'Señales tempranas para proteger volumen, conversión y participación.');
  addBulletList(pptx, s, model.risks, { y: 1.78, h: 4.98, accent: COLORS.red, fontSize: 14 });

  s = slide('Recomendaciones ejecutables y responsables claros', 'Recomendaciones', 'Cada acción se vincula con una evidencia y un indicador de control.');
  addBulletList(pptx, s, model.recommendations, { y: 1.78, h: 4.98, accent: COLORS.blue, fontSize: 14 });

  s = slide('Plan de acción para el siguiente ciclo de gestión', 'Plan de acción', 'Horizonte, responsable, indicador y criterio de éxito.');
  const actionRows = [
    [{ text: 'PRIORIDAD', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'ACCIÓN', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'RESPONSABLE', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'HORIZONTE', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'INDICADOR', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }],
    ...model.actionPlan.slice(0, 7).map(row => [row.priority, row.action, row.owner, row.horizon, row.indicator]),
  ];
  s.addTable(actionRows, { ...tableOptions([1.35, 4.55, 2.15, 1.25, 2.9], .54), x: .58, y: 1.78, w: 12.15, h: 4.92, fontSize: 9.5, margin: .1 });

  s = slide('Proteger, corregir y acelerar', 'Cierre ejecutivo', 'Tres frentes para concentrar la conversación directiva y el seguimiento.');
  const close = [
    { x: .58, title: 'PROTEGER', color: COLORS.green, fill: COLORS.greenBg, data: model.closing.protect },
    { x: 4.48, title: 'CORREGIR', color: COLORS.red, fill: COLORS.redBg, data: model.closing.correct },
    { x: 8.38, title: 'ACELERAR', color: COLORS.blue, fill: 'EEF5FF', data: model.closing.accelerate },
  ];
  close.forEach(column => {
    s.addShape(pptx.ShapeType.roundRect, { x: column.x, y: 1.82, w: 3.52, h: 4.65, rectRadius: .07, fill: { color: column.fill }, line: { color: column.color, width: 1.2 } });
    s.addText(column.title, { x: column.x + .22, y: 2.1, w: 3.08, h: .32, fontFace: 'Aptos Display', fontSize: 19, bold: true, color: column.color, align: 'center', margin: 0 });
    s.addText(column.data.map(item => ({ text: `${item}\n`, options: { bullet: { indent: 14 }, breakLine: true } })), { x: column.x + .28, y: 2.72, w: 2.98, h: 3.15, fontFace: 'Aptos', fontSize: 12, color: COLORS.ink, breakLine: false, margin: .04, paraSpaceAfterPt: 10, fit: 'shrink' });
  });

  onProgress({ stage: 'Validando y guardando PowerPoint', percent: 94 });
  const fileName = model.fileName || `CR3_Drive_Intelligence_360_${model.periodToken}.pptx`;
  await pptx.writeFile({ fileName });
  onProgress({ stage: 'Presentación completada', percent: 100 });
  return { fileName, slideCount: page };
}
