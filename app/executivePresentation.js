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
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .76, fill: { color: COLORS.navy }, line: { color: COLORS.navy } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: .76, w: 13.333, h: .06, fill: { color: COLORS.cyan }, line: { color: COLORS.cyan } });
  slide.addShape(pptx.ShapeType.roundRect, { x: .23, y: .09, w: 2.78, h: .56, rectRadius: .04, fill: { color: COLORS.white }, line: { color: 'DCE9FA', transparency: 100 } });
  slide.addImage({ path: model.logoDrive, x: .34, y: .13, w: .86, h: .45, transparency: 0 });
  slide.addImage({ data: model.logoBrands, x: 1.35, y: .2, w: 1.52, h: .27 });
  slide.addText(clean(kicker).toUpperCase(), { x: 3.24, y: .12, w: 4.2, h: .18, fontFace: 'Aptos', fontSize: 8.5, bold: true, color: COLORS.sky, charSpacing: 1.25, margin: 0 });
  slide.addText('CR3 DRIVE INTELLIGENCE 360', { x: 3.24, y: .36, w: 5.7, h: .22, fontFace: 'Aptos Display', fontSize: 14.5, bold: true, color: COLORS.white, margin: 0 });
  slide.addText(model.scopeLabel, { x: .42, y: 7.13, w: 10.7, h: .15, fontFace: 'Aptos', fontSize: 7.5, color: COLORS.muted, margin: 0 });
  slide.addText(String(page), { x: 12.45, y: 7.11, w: .42, h: .16, fontFace: 'Aptos', fontSize: 8, bold: true, color: COLORS.muted, align: 'right', margin: 0 });
}

function addTitle(slide, title, subtitle = '') {
  slide.addText(title, { x: .48, y: .96, w: 12.25, h: .5, fontFace: 'Aptos Display', fontSize: 29, bold: true, color: COLORS.ink, margin: 0, fit: 'shrink' });
  if (subtitle) slide.addText(subtitle, { x: .5, y: 1.48, w: 12.1, h: .28, fontFace: 'Aptos', fontSize: 12.5, color: COLORS.slate, margin: 0, fit: 'shrink' });
}

function addCard(pptx, slide, { x, y, w, h, label, value, detail, color = COLORS.blue, fill = COLORS.white }) {
  const displayValue = clean(value);
  const valueSize = displayValue.length > 25 ? 16 : displayValue.length > 15 ? 20 : 28;
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: .06, fill: { color: fill }, line: { color: COLORS.line, width: 1 } });
  slide.addShape(pptx.ShapeType.rect, { x, y, w, h: .075, fill: { color }, line: { color } });
  slide.addText(clean(label).toUpperCase(), { x: x + .18, y: y + .18, w: w - .36, h: .2, fontFace: 'Aptos', fontSize: 9, bold: true, color: COLORS.muted, charSpacing: .45, margin: 0, fit: 'shrink' });
  slide.addText(displayValue, { x: x + .18, y: y + .42, w: w - .36, h: .62, fontFace: 'Aptos Display', fontSize: valueSize, bold: true, color: COLORS.ink, margin: 0, fit: 'shrink', valign: 'mid' });
  if (detail) slide.addText(clean(detail), { x: x + .18, y: y + h - .34, w: w - .36, h: .2, fontFace: 'Aptos', fontSize: 9.5, color: COLORS.slate, margin: 0, fit: 'shrink' });
}

function addInsight(pptx, slide, text, { x = .5, y = 6.45, w = 12.25, color = COLORS.blue } = {}) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: .58, rectRadius: .05, fill: { color: 'EEF5FF' }, line: { color: 'BFD6FA', width: .9 } });
  slide.addText('LECTURA EJECUTIVA', { x: x + .18, y: y + .18, w: 1.42, h: .16, fontFace: 'Aptos', fontSize: 8, bold: true, color, charSpacing: .55, margin: 0 });
  slide.addText(clean(text), { x: x + 1.68, y: y + .1, w: w - 1.88, h: .38, fontFace: 'Aptos', fontSize: 10.8, color: COLORS.ink, margin: 0, fit: 'shrink', valign: 'middle' });
}

function addSectionSlide(pptx, slide, model, page, number, title, subtitle) {
  slide.background = { color: COLORS.navy };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 6.9, w: 13.333, h: .6, fill: { color: COLORS.cyan }, line: { color: COLORS.cyan } });
  slide.addShape(pptx.ShapeType.roundRect, { x: .56, y: .45, w: 3.72, h: .82, rectRadius: .06, fill: { color: COLORS.white }, line: { color: COLORS.white } });
  slide.addImage({ path: model.logoDrive, x: .68, y: .56, w: 1.1, h: .58 });
  slide.addImage({ data: model.logoBrands, x: 2.08, y: .7, w: 2.0, h: .33 });
  slide.addText(String(number).padStart(2, '0'), { x: .75, y: 2.02, w: 1.25, h: 1.15, fontFace: 'Aptos Display', fontSize: 60, bold: true, color: COLORS.sky, margin: 0 });
  slide.addText(title, { x: 2.15, y: 2.12, w: 9.9, h: .82, fontFace: 'Aptos Display', fontSize: 40, bold: true, color: COLORS.white, margin: 0, fit: 'shrink' });
  slide.addText(subtitle, { x: 2.18, y: 3.12, w: 9.6, h: .78, fontFace: 'Aptos', fontSize: 18, color: 'DCE9FA', margin: 0, fit: 'shrink' });
  slide.addText(`${model.scopeLabel} · ${page}`, { x: 2.18, y: 5.9, w: 9.5, h: .22, fontFace: 'Aptos', fontSize: 9.5, color: 'AFC4DF', margin: 0 });
}

function addBulletList(pptx, slide, items, { x = .65, y = 1.8, w = 12, h = 4.9, accent = COLORS.blue, fontSize = 15 } = {}) {
  const safe = items.filter(Boolean).slice(0, 7);
  const rowH = h / Math.max(safe.length, 1);
  safe.forEach((item, index) => {
    const top = y + index * rowH;
    slide.addShape(pptx.ShapeType.ellipse, { x, y: top + .11, w: .22, h: .22, fill: { color: item.color || accent }, line: { color: item.color || accent } });
    slide.addText(clean(item.title || item), { x: x + .36, y: top, w: 3.25, h: .44, fontFace: 'Aptos Display', fontSize, bold: true, color: COLORS.ink, margin: 0, fit: 'shrink', valign: 'mid' });
    slide.addText(clean(item.detail || ''), { x: x + 3.72, y: top, w: w - 4.05, h: .56, fontFace: 'Aptos', fontSize: Math.max(fontSize - 3, 12), color: COLORS.slate, margin: 0, fit: 'shrink', valign: 'middle' });
    if (index < safe.length - 1) slide.addShape(pptx.ShapeType.line, { x: x + .34, y: top + rowH - .08, w: w - .34, h: 0, line: { color: COLORS.line, width: .6 } });
  });
}

function addBarChart(pptx, slide, rows, { x, y, w, h, name = 'Valor', color = COLORS.blue, percentage = false, max = null }) {
  if (!rows.length) return;
  slide.addChart(pptx.ChartType.bar, [{ name, labels: rows.map(row => row.label), values: rows.map(row => finite(row.value)) }], {
    x, y, w, h, catAxisLabelFontFace: 'Aptos', catAxisLabelFontSize: 10.5,
    valAxisLabelFontFace: 'Aptos', valAxisLabelFontSize: 10, showLegend: false, showTitle: false,
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
    x, y, w, h, showLegend: true, legendPos: 'b', legendFontFace: 'Aptos', legendFontSize: 10,
    catAxisLabelFontFace: 'Aptos', catAxisLabelFontSize: 10, valAxisLabelFontFace: 'Aptos', valAxisLabelFontSize: 10,
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
    fill: COLORS.white, color: COLORS.ink, fontFace: 'Aptos', fontSize: 10.5,
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
  cover.addText('CR3 DRIVE INTELLIGENCE 360', { x: .82, y: 1.7, w: 11.7, h: .4, fontFace: 'Aptos', fontSize: 16, bold: true, color: COLORS.sky, charSpacing: 2.2, margin: 0 });
  cover.addText(model.coverTitle || 'LECTURA EJECUTIVA INTEGRADA DEL NEGOCIO', { x: .82, y: 2.23, w: 11.65, h: 1.28, fontFace: 'Aptos Display', fontSize: 40, bold: true, color: COLORS.white, margin: 0, fit: 'shrink' });
  cover.addText(`${model.periodLabel} · ${model.branchLabel} · ${model.brandLabel}`, { x: .84, y: 3.76, w: 11.2, h: .48, fontFace: 'Aptos', fontSize: 20, bold: true, color: COLORS.white, margin: 0, fit: 'shrink' });
  cover.addText('Mercado, operación, BDC, Marketing, planeación comercial y territorio en una sola lectura.', { x: .84, y: 4.48, w: 11.35, h: .52, fontFace: 'Aptos', fontSize: 15, color: 'DCE9FA', margin: 0 });
  cover.addText(`Generada el ${model.generatedLabel}`, { x: .84, y: 5.38, w: 5, h: .23, fontFace: 'Aptos', fontSize: 10, color: 'AFC4DF', margin: 0 });

  let s = slide(model.executiveTitle, 'Resumen ejecutivo', 'La lectura combina resultado, tendencia, posición competitiva, palancas operativas y territorio.');
  const cards = model.snapshot.slice(0, 6);
  cards.forEach((card, index) => addCard(pptx, s, { x: .52 + (index % 3) * 4.13, y: 1.88 + Math.floor(index / 3) * 1.72, w: 3.85, h: 1.5, ...card }));
  addInsight(pptx, s, model.executiveSummary, { y: 5.55 });

  s = slide('Las cinco decisiones que requieren atención directiva', 'Prioridades', 'Cada punto conecta evidencia, efecto comercial y una decisión concreta.');
  addBulletList(pptx, s, model.topFindings, { y: 1.86, h: 4.72, fontSize: 17 });

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
    addInsight(pptx, s, model.industry.insight, { y: 6.08 });
  } else addBulletList(pptx, s, [{ title: 'Información no disponible', detail: model.industry.unavailableReason }], { y: 2.2, h: 1.3 });

  s = slide(model.amda.title, 'AMDA Chihuahua', model.amda.subtitle);
  if (model.amda.available) {
    addCard(pptx, s, { x: .52, y: 1.82, w: 2.9, h: 1.42, label: 'Mercado estatal', value: fmt(model.amda.market), detail: model.amda.category });
    addCard(pptx, s, { x: 3.62, y: 1.82, w: 2.9, h: 1.42, label: 'Unidades seleccionadas', value: fmt(model.amda.selectedUnits), detail: model.amda.brandLabel, color: COLORS.green });
    addCard(pptx, s, { x: 6.72, y: 1.82, w: 2.9, h: 1.42, label: 'Participación estatal', value: pct(model.amda.share), detail: `Cambio anual ${signedPp(model.amda.annualPp)}`, color: COLORS.cyan });
    addCard(pptx, s, { x: 9.82, y: 1.82, w: 2.9, h: 1.42, label: 'Agencia líder', value: model.amda.leadingAgency || '—', detail: `${fmt(model.amda.leadingAgencyUnits)} unidades`, color: COLORS.amber });
    addBarChart(pptx, s, model.amda.brandRanking.slice(0, 10), { x: .58, y: 3.46, w: 5.9, h: 2.52, name: 'Participación', percentage: true, color: COLORS.teal });
    addBarChart(pptx, s, model.amda.agencyRanking.slice(0, 10), { x: 6.75, y: 3.46, w: 5.82, h: 2.52, name: 'Unidades', color: COLORS.blue });
    addInsight(pptx, s, model.amda.insight, { y: 6.08 });
  } else addBulletList(pptx, s, [{ title: 'Información no disponible', detail: model.amda.unavailableReason }], { y: 2.2, h: 1.3 });

  section(2, 'Desempeño comercial interno', 'Cómo se traduce el mercado en actividad, conversión, venta y entrega dentro de la red.');
  onProgress({ stage: 'Analizando desempeño y funnel', percent: 50 });

  s = slide(model.performance.title, 'Resultado interno', model.performance.subtitle);
  model.performance.cards.forEach((card, index) => addCard(pptx, s, { x: .52 + index * 2.5, y: 1.82, w: 2.28, h: 1.42, ...card }));
  addLineChart(pptx, s, model.performance.series, { x: .58, y: 3.48, w: 7.5, h: 2.53 });
  addBarChart(pptx, s, model.performance.branchRanking.slice(0, 10), { x: 8.34, y: 3.46, w: 4.25, h: 2.55, name: 'Ventas', color: COLORS.blue });
  addInsight(pptx, s, model.performance.insight, { y: 6.08 });

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
  s.addTable(funnelRows, { ...tableOptions([2.55, 1.15, 1.25, 1.25], .46), x: .58, y: 1.82, w: 6.2, h: 4.45, fontSize: 12, margin: .09 });
  addBarChart(pptx, s, model.funnel.rows.map(row => ({ label: row.label, value: row.value })), { x: 7.12, y: 1.88, w: 5.35, h: 4.05, name: 'Registros', color: COLORS.cyan });
  addInsight(pptx, s, model.funnel.insight, { y: 6.12 });

  s = slide(model.drivers.title, 'Equipos y sucursales', model.drivers.subtitle);
  addBarChart(pptx, s, model.drivers.branches.slice(0, 10), { x: .58, y: 1.82, w: 6.05, h: 3.6, name: 'Ventas', color: COLORS.green });
  addBarChart(pptx, s, model.drivers.apvs.slice(0, 10), { x: 6.83, y: 1.82, w: 5.75, h: 3.6, name: 'Registros cerrados', color: COLORS.blue });
  addBulletList(pptx, s, model.drivers.notes, { x: .66, y: 5.48, w: 11.8, h: .76, fontSize: 13 });
  addInsight(pptx, s, model.drivers.insight, { y: 6.27 });

  s = slide(model.blockers.title, 'Bloqueos y fugas', model.blockers.subtitle);
  addBulletList(pptx, s, model.blockers.items, { x: .65, y: 1.86, w: 12, h: 4.7, accent: COLORS.red, fontSize: 17 });

  section(3, 'Generación de demanda y planeación', 'Cómo avanzan BDC, Marketing y la ruta mínima requerida para cumplir la meta.');
  onProgress({ stage: 'Integrando BDC, Marketing y Funnel Requerido', percent: 62 });

  s = slide(model.bdc.title, 'BDC', model.bdc.subtitle);
  if (model.bdc.available) {
    model.bdc.cards.slice(0, 5).forEach((card, index) => addCard(pptx, s, { x: .52 + index * 2.5, y: 1.82, w: 2.28, h: 1.42, ...card }));
    addBarChart(pptx, s, model.bdc.stages, { x: .58, y: 3.48, w: 6.0, h: 2.5, name: 'Registros', color: COLORS.cyan });
    addBarChart(pptx, s, model.bdc.branchRanking.slice(0, 10), { x: 6.86, y: 3.48, w: 5.72, h: 2.5, name: 'Cierres', color: COLORS.green });
    addInsight(pptx, s, model.bdc.insight, { y: 6.08 });
  } else addBulletList(pptx, s, [{ title: 'Información no disponible', detail: model.bdc.unavailableReason }], { y: 2.2, h: 1.3, fontSize: 17 });

  s = slide(model.marketing.title, 'Marketing', model.marketing.subtitle);
  if (model.marketing.available) {
    model.marketing.cards.slice(0, 5).forEach((card, index) => addCard(pptx, s, { x: .52 + index * 2.5, y: 1.82, w: 2.28, h: 1.42, ...card }));
    addBarChart(pptx, s, model.marketing.campaignRanking.slice(0, 8), { x: .58, y: 3.48, w: 6.0, h: 2.5, name: 'Registros', color: COLORS.blue });
    addBarChart(pptx, s, model.marketing.modelRanking.slice(0, 10), { x: 6.86, y: 3.48, w: 5.72, h: 2.5, name: 'Ventas', color: COLORS.teal });
    addInsight(pptx, s, model.marketing.insight, { y: 6.08 });
  } else addBulletList(pptx, s, [{ title: 'Información no disponible', detail: model.marketing.unavailableReason }], { y: 2.2, h: 1.3, fontSize: 17 });

  s = slide(model.requiredFunnel.title, 'Funnel requerido', model.requiredFunnel.subtitle);
  if (model.requiredFunnel.available) {
    model.requiredFunnel.cards.slice(0, 4).forEach((card, index) => addCard(pptx, s, { x: .52 + index * 3.1, y: 1.82, w: 2.88, h: 1.42, ...card }));
    const requiredRows = [
      [{ text: 'ETAPA', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'REQUERIDO', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'REALIZADO', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'BRECHA', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }],
      ...model.requiredFunnel.stages.map((row, index) => [
        { text: row.label, options: { bold: true, fill: index % 2 ? 'F7FAFE' : COLORS.white } },
        { text: fmt(row.required), options: { bold: true, color: COLORS.blue, align: 'right', fill: index % 2 ? 'F7FAFE' : COLORS.white } },
        { text: fmt(row.actual), options: { bold: true, color: COLORS.green, align: 'right', fill: index % 2 ? 'F7FAFE' : COLORS.white } },
        { text: fmt(row.gap), options: { bold: true, color: row.gap > 0 ? COLORS.red : COLORS.green, align: 'right', fill: index % 2 ? 'F7FAFE' : COLORS.white } },
      ]),
    ];
    s.addTable(requiredRows, { ...tableOptions([2.45, 1.18, 1.18, 1.18], .35), x: .58, y: 3.46, w: 5.99, h: 2.42, fontSize: 11.5, margin: .08 });
    addBarChart(pptx, s, model.requiredFunnel.branchGaps.filter(row => row.value > 0).slice(0, 10), { x: 6.86, y: 3.46, w: 5.72, h: 2.48, name: 'Ventas pendientes', color: COLORS.red });
    addInsight(pptx, s, model.requiredFunnel.insight, { y: 6.08 });
  } else addBulletList(pptx, s, [{ title: 'Metas no disponibles', detail: model.requiredFunnel.unavailableReason }], { y: 2.2, h: 1.3, fontSize: 17 });

  section(4, 'Territorio y demanda', 'Dónde se concentra la venta y qué zonas justifican acciones comerciales específicas.');
  onProgress({ stage: 'Integrando GeoInteligencia', percent: 74 });

  s = slide(model.geo.title, 'GeoInteligencia', model.geo.subtitle);
  if (model.geo.available) {
    addCard(pptx, s, { x: .52, y: 1.82, w: 2.75, h: 1.42, label: 'Ventas georreferenciadas', value: fmt(model.geo.sales), detail: `${model.geo.postalCodes} códigos postales` });
    addCard(pptx, s, { x: 3.47, y: 1.82, w: 2.75, h: 1.42, label: 'Zona líder', value: model.geo.leadingPostalCode || '—', detail: `${fmt(model.geo.leadingSales)} ventas`, color: COLORS.cyan });
    addCard(pptx, s, { x: 6.42, y: 1.82, w: 2.75, h: 1.42, label: 'Concentración Top 5', value: pct(model.geo.top5Share), detail: 'Participación territorial', color: COLORS.amber });
    addCard(pptx, s, { x: 9.37, y: 1.82, w: 3.35, h: 1.42, label: 'Sucursal territorial líder', value: model.geo.leadingBranch || '—', detail: `${fmt(model.geo.leadingBranchSales)} ventas`, color: COLORS.green });
    addBarChart(pptx, s, model.geo.ranking.slice(0, 12), { x: .58, y: 3.5, w: 6.1, h: 2.45, name: 'Ventas', color: COLORS.blue });
    addBarChart(pptx, s, model.geo.colonies.slice(0, 12), { x: 6.9, y: 3.5, w: 5.68, h: 2.45, name: 'Ventas', color: COLORS.teal });
    addInsight(pptx, s, model.geo.insight, { y: 6.08 });
  } else addBulletList(pptx, s, [{ title: 'Información no disponible', detail: model.geo.unavailableReason }], { y: 2.2, h: 1.3 });

  s = slide(model.geoPriorities.title, 'Prioridades geográficas', model.geoPriorities.subtitle);
  if (model.geo.available) {
    const geoRows = [
      [{ text: '#', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'CP / ZONA', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'COLONIA / MUNICIPIO', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'VENTAS', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'PART.', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'SUCURSAL LÍDER', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }],
      ...model.geo.ranking.slice(0, 10).map((row, index) => [String(index + 1), row.label, row.detail || '—', fmt(row.value), pct(row.share), row.branch || '—']),
    ];
    s.addTable(geoRows, { ...tableOptions([.55, 1.45, 4.15, 1.25, 1.1, 3.7], .39), x: .58, y: 1.82, w: 12.15, h: 4.55, fontSize: 11, margin: .08 });
    addInsight(pptx, s, model.geoPriorities.insight, { y: 6.3 });
  } else addBulletList(pptx, s, [{ title: 'Sin base territorial', detail: model.geo.unavailableReason }], { y: 2.2, h: 1.3 });

  section(5, 'Decisiones y plan de acción', 'Convertir hallazgos en prioridades, responsables, indicadores y cadencia de seguimiento.');
  onProgress({ stage: 'Construyendo recomendaciones', percent: 86 });

  s = slide('La lectura cruzada revela oportunidades que ningún módulo muestra por separado', 'Hallazgos integrados', 'Relaciones causales e hipótesis sustentadas en los datos disponibles.');
  addBulletList(pptx, s, model.crossInsights, { y: 1.86, h: 4.7, accent: COLORS.teal, fontSize: 17 });

  s = slide('Oportunidades con potencial de impacto medible', 'Oportunidades', 'Priorizadas por magnitud, urgencia y capacidad de ejecución.');
  addBulletList(pptx, s, model.opportunities, { y: 1.86, h: 4.7, accent: COLORS.green, fontSize: 17 });

  s = slide('Riesgos que pueden frenar el resultado del periodo', 'Riesgos', 'Señales tempranas para proteger volumen, conversión y participación.');
  addBulletList(pptx, s, model.risks, { y: 1.86, h: 4.7, accent: COLORS.red, fontSize: 17 });

  s = slide('Recomendaciones ejecutables y responsables claros', 'Recomendaciones', 'Cada acción se vincula con una evidencia y un indicador de control.');
  addBulletList(pptx, s, model.recommendations, { y: 1.86, h: 4.7, accent: COLORS.blue, fontSize: 17 });

  s = slide('Plan de acción para el siguiente ciclo de gestión', 'Plan de acción', 'Horizonte, responsable, indicador y criterio de éxito.');
  const actionRows = [
    [{ text: 'PRIORIDAD', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'ACCIÓN', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'RESPONSABLE', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'HORIZONTE', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }, { text: 'INDICADOR', options: { bold: true, color: COLORS.white, fill: COLORS.navy } }],
    ...model.actionPlan.slice(0, 7).map(row => [row.priority, row.action, row.owner, row.horizon, row.indicator]),
  ];
  s.addTable(actionRows, { ...tableOptions([1.35, 4.55, 2.15, 1.25, 2.9], .58), x: .58, y: 1.82, w: 12.15, h: 4.75, fontSize: 11.5, margin: .1 });

  s = slide('Proteger, corregir y acelerar', 'Cierre ejecutivo', 'Tres frentes para concentrar la conversación directiva y el seguimiento.');
  const close = [
    { x: .58, title: 'PROTEGER', color: COLORS.green, fill: COLORS.greenBg, data: model.closing.protect },
    { x: 4.48, title: 'CORREGIR', color: COLORS.red, fill: COLORS.redBg, data: model.closing.correct },
    { x: 8.38, title: 'ACELERAR', color: COLORS.blue, fill: 'EEF5FF', data: model.closing.accelerate },
  ];
  close.forEach(column => {
    s.addShape(pptx.ShapeType.roundRect, { x: column.x, y: 1.82, w: 3.52, h: 4.65, rectRadius: .07, fill: { color: column.fill }, line: { color: column.color, width: 1.2 } });
    s.addText(column.title, { x: column.x + .22, y: 2.08, w: 3.08, h: .38, fontFace: 'Aptos Display', fontSize: 22, bold: true, color: column.color, align: 'center', margin: 0 });
    s.addText(column.data.map(item => ({ text: `${item}\n`, options: { bullet: { indent: 15 }, breakLine: true } })), { x: column.x + .28, y: 2.66, w: 2.98, h: 3.35, fontFace: 'Aptos', fontSize: 14.5, color: COLORS.ink, breakLine: false, margin: .04, paraSpaceAfterPt: 13, fit: 'shrink' });
  });

  onProgress({ stage: 'Validando y guardando PowerPoint', percent: 94 });
  const fileName = model.fileName || `CR3_Drive_Intelligence_360_${model.periodToken}.pptx`;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const output = await pptx.write({ outputType: 'blob' });
    const blob = output instanceof Blob ? output : new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  } else {
    await pptx.writeFile({ fileName });
  }
  onProgress({ stage: 'Presentación completada', percent: 100 });
  return { fileName, slideCount: page };
}
