// Izvoz u Excel — isti izgled kao "Trifa_prekovremeni_2026.xlsx" (jedan list po mjesecu, formule ostaju zive).
import { entriesOf, periodLabel, periodStats, dayName, getPeriod } from './core.js';

const NAVY = 'FF1F3864', BLUE = 'FF2E5395', GOLD = 'FFC9A227', CREAM = 'FFFBF3DE', ZEBRA = 'FFF2F2F2',
  WHITE = 'FFFFFFFF', INK = 'FF262626', MUTED = 'FF6B6B6B', WEEKEND = 'FFFCE4D6', GRID = 'FFD0D0D0', SIGN = 'FF888888';
const DAY_LIST = '"Ponedjeljak","Utorak","Srijeda","Četvrtak","Petak","Subota","Nedjelja"';
const DATE_FMT = 'dd\\.mm\\.yyyy\\.';
const H_FMT = 'General" h"';

let loading = null;
export function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'lib/exceljs.min.js';
    s.onload = resolve;
    s.onerror = () => { loading = null; reject(new Error('Excel biblioteka se nije učitala (provjeri internet).')); };
    document.head.append(s);
  });
  return loading;
}

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const font = (o = {}) => ({ name: 'Arial', size: 10, color: { argb: INK }, ...o });
const line = (style, argb) => ({ style, color: { argb } });
const xlDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

function style(cell, { f, fl, al, nf, b } = {}) {
  if (f) cell.font = font(f);
  if (fl) cell.fill = fill(fl);
  if (al) cell.alignment = { vertical: 'middle', ...al };
  if (nf) cell.numFmt = nf;
  if (b) cell.border = b;
}

function addMonthSheet(wb, doc, pid) {
  const list = entriesOf(doc, pid);
  const st = periodStats(list);
  const N = Math.max(20, list.length + 2);
  const first = 10, last = first + N - 1, tot = last + 1;
  const p = getPeriod(doc, pid);
  const name = periodLabel(pid);
  const ws = wb.addWorksheet(name, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: p?.status === 'open' ? GOLD : NAVY } },
    pageSetup: {
      paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });
  ws.columns = [{ width: 6.53 }, { width: 13 }, { width: 13 }, { width: 34 }, { width: 9.53 }, { width: 22 }];
  const prof = doc.profile;

  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = 'EVIDENCIJA PREKOVREMENIH SATI';
  style(ws.getCell('A1'), { f: { size: 18, bold: true, color: { argb: WHITE } }, fl: NAVY, al: { horizontal: 'center' } });
  ws.getRow(1).height = 33.75;
  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = prof.unit || 'INVENDA SYSTEMS  •  PROIZVODNJA';
  style(ws.getCell('A2'), { f: { size: 11, bold: true, color: { argb: GOLD } }, fl: BLUE, al: { horizontal: 'center' } });
  ws.getRow(2).height = 19.5;
  ws.getRow(3).height = 7.5;

  const info = [['Zaposleni:', prof.name], ['Pozicija:', prof.position || ''], ['Period:', name],
    ['Ažurirano:', { formula: 'TODAY()', result: xlDate(new Date().toISOString().slice(0, 10)) }]];
  info.forEach(([label, value], i) => {
    const r = 4 + i;
    ws.mergeCells(`A${r}:B${r}`); ws.mergeCells(`C${r}:F${r}`);
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`C${r}`).value = value;
    for (const col of 'ABCDEF') style(ws.getCell(`${col}${r}`), { b: { bottom: line('thin', GRID) } });
    style(ws.getCell(`A${r}`), { f: { bold: true }, al: { horizontal: 'left' } });
    style(ws.getCell(`C${r}`), { f: {}, al: { horizontal: 'left' }, nf: i === 3 ? DATE_FMT : undefined });
    ws.getRow(r).height = 18;
  });
  ws.getRow(8).height = 7.5;

  const heads = ['R.br.', 'Datum', 'Dan', 'Opis rada', 'Sati', 'Napomena'];
  heads.forEach((h, i) => {
    const c = ws.getRow(9).getCell(i + 1);
    c.value = h;
    style(c, {
      f: { size: 11, bold: true, color: { argb: WHITE } }, fl: NAVY, al: { horizontal: 'center' },
      b: { top: line('medium', NAVY), bottom: line('medium', NAVY),
        left: i === 0 ? line('medium', NAVY) : line('thin', GRID), right: i === 5 ? line('medium', NAVY) : line('thin', GRID) },
    });
  });
  ws.getRow(9).height = 21.75;

  for (let i = 0; i < N; i++) {
    const r = first + i, e = list[i];
    const row = ws.getRow(r);
    row.height = 16.5;
    row.getCell(1).value = { formula: `IF(B${r}="","",ROW()-${first - 1})`, result: e ? i + 1 : '' };
    row.getCell(3).value = { formula: `IF(B${r}="","",CHOOSE(WEEKDAY(B${r},2),${DAY_LIST}))`, result: e ? dayName(e.date) : '' };
    if (e) {
      row.getCell(2).value = xlDate(e.date);
      row.getCell(4).value = e.desc;
      row.getCell(5).value = e.expr && /^\d+(\.\d+)?(\+\d+(\.\d+)?)+$/.test(e.expr)
        ? { formula: e.expr, result: e.hours } : e.hours;
      if (e.note) row.getCell(6).value = e.note;
    }
    const bg = i % 2 ? ZEBRA : WHITE;
    for (let cIdx = 1; cIdx <= 6; cIdx++) {
      const c = row.getCell(cIdx);
      style(c, {
        f: cIdx === 6 ? { size: 9, italic: true, color: { argb: MUTED } } : {},
        fl: bg,
        al: { horizontal: cIdx === 4 || cIdx === 6 ? 'left' : 'center', wrapText: cIdx === 4 },
        nf: cIdx === 2 ? DATE_FMT : cIdx === 5 ? H_FMT : undefined,
        b: { top: line('thin', GRID), bottom: line('thin', GRID),
          left: cIdx === 1 ? line('medium', NAVY) : line('thin', GRID), right: cIdx === 6 ? line('medium', NAVY) : line('thin', GRID) },
      });
    }
  }

  ws.mergeCells(`A${tot}:D${tot}`); ws.mergeCells(`E${tot}:F${tot}`);
  ws.getCell(`A${tot}`).value = 'UKUPNO SATI:';
  ws.getCell(`E${tot}`).value = { formula: `SUM(E${first}:E${last})`, result: st.total };
  for (let cIdx = 1; cIdx <= 6; cIdx++) {
    style(ws.getRow(tot).getCell(cIdx), {
      f: { size: cIdx >= 5 ? 13 : 11, bold: true, color: { argb: WHITE } }, fl: NAVY,
      al: { horizontal: cIdx >= 5 ? 'center' : 'right' }, nf: cIdx >= 5 ? H_FMT : undefined,
      b: { top: line('medium', NAVY), bottom: line('medium', NAVY),
        left: cIdx === 1 ? line('medium', NAVY) : undefined, right: cIdx === 6 ? line('medium', NAVY) : undefined },
    });
  }
  ws.getRow(tot).height = 24;
  ws.getRow(tot + 1).height = 9.75;

  const pr = tot + 2;
  ws.mergeCells(`A${pr}:F${pr}`);
  ws.getCell(`A${pr}`).value = 'PREGLED';
  style(ws.getCell(`A${pr}`), { f: { size: 12, bold: true, color: { argb: WHITE } }, fl: BLUE, al: { horizontal: 'center' } });
  ws.getRow(pr).height = 19.5;
  const B = `B${first}:B${last}`, C = `C${first}:C${last}`, E = `E${first}:E${last}`;
  const summary = [
    ['Ukupno sati:', `E${tot}`, st.total, H_FMT],
    ['Broj unosa:', `COUNT(${E})`, st.count, '0'],
    ['Broj dana sa unosima:', `ROUND(SUMPRODUCT(((${B})<>"")/COUNTIF(${B},${B}&"")),0)`, st.days, '0'],
    ['Prosječno sati po unosu:', `IFERROR(AVERAGE(${E}),0)`, st.avg, '0.0" h"'],
    ['Najduži pojedinačni unos:', `MAX(${E})`, st.max, H_FMT],
    ['Sati odrađeni vikendom:', `SUMIFS(${E},${C},"Subota")+SUMIFS(${E},${C},"Nedjelja")`, st.weekend, H_FMT],
  ];
  summary.forEach(([label, formula, result, nf], i) => {
    const r = pr + 1 + i;
    ws.mergeCells(`A${r}:C${r}`); ws.mergeCells(`D${r}:F${r}`);
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`D${r}`).value = { formula, result };
    for (let cIdx = 1; cIdx <= 6; cIdx++) {
      style(ws.getRow(r).getCell(cIdx), {
        f: cIdx >= 4 ? { size: 12, bold: true, color: { argb: NAVY } } : { bold: true },
        fl: CREAM, al: { horizontal: 'left' }, nf: cIdx >= 4 ? nf : undefined, b: { bottom: line('thin', GRID) },
      });
    }
    ws.getRow(r).height = 18;
  });
  ws.getRow(pr + 7).height = 9.75;

  const s1 = tot + 27, s2 = tot + 29;
  ws.getRow(s1 - 1).height = 9.75;
  [[s1, 'Potpis zaposlenog:'], [s2, 'Odobrio (rukovodilac):']].forEach(([r, label]) => {
    ws.mergeCells(`A${r}:B${r}`); ws.mergeCells(`C${r}:D${r}`);
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`E${r}`).value = 'Datum:';
    style(ws.getCell(`A${r}`), { f: {}, al: { horizontal: 'left' } });
    style(ws.getCell(`E${r}`), { f: {}, al: { horizontal: 'left' } });
    for (const col of ['C', 'D', 'F']) style(ws.getCell(`${col}${r}`), { b: { bottom: line('thin', SIGN) } });
    ws.getRow(r).height = 25.5;
  });

  ws.addConditionalFormatting({
    ref: `A${first}:F${last}`,
    rules: [{ type: 'expression', priority: 1, formulae: [`OR($C${first}="Subota",$C${first}="Nedjelja")`],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: WEEKEND } } } }],
  });
  ws.addConditionalFormatting({
    ref: E,
    rules: [{ type: 'dataBar', priority: 2, gradient: false, minLength: 0, maxLength: 100,
      cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: GOLD } }],
  });
  ws.pageSetup.printArea = `A1:F${s2}`;
  return { pid, name, tot, pr, st, status: p?.status };
}

function addSummarySheet(wb, doc, infos, title) {
  const ws = wb.addWorksheet(title, {
    views: [{ showGridLines: false }], properties: { tabColor: { argb: BLUE } },
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true },
  });
  ws.columns = [{ width: 22 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 14 }];
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = `PREKOVREMENI SATI — ${title.toUpperCase()}`;
  style(ws.getCell('A1'), { f: { size: 16, bold: true, color: { argb: WHITE } }, fl: NAVY, al: { horizontal: 'center' } });
  ws.getRow(1).height = 30;
  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = `${doc.profile.name}  •  ${doc.profile.position || ''}`;
  style(ws.getCell('A2'), { f: { size: 11, bold: true, color: { argb: GOLD } }, fl: BLUE, al: { horizontal: 'center' } });
  ws.getRow(2).height = 19.5;
  const heads = ['Period', 'Status', 'Broj unosa', 'Dana', 'Sati vikendom', 'Ukupno sati'];
  heads.forEach((h, i) => {
    const c = ws.getRow(4).getCell(i + 1);
    c.value = h;
    style(c, { f: { bold: true, color: { argb: WHITE } }, fl: NAVY, al: { horizontal: 'center', wrapText: true } });
  });
  ws.getRow(4).height = 21;
  infos.forEach((inf, i) => {
    const r = 5 + i, q = `'${inf.name}'!`;
    const row = ws.getRow(r);
    row.getCell(1).value = inf.name;
    row.getCell(2).value = inf.status === 'open' ? 'Otvoren' : 'Predat';
    row.getCell(3).value = { formula: `${q}D${inf.pr + 2}`, result: inf.st.count };
    row.getCell(4).value = { formula: `${q}D${inf.pr + 3}`, result: inf.st.days };
    row.getCell(5).value = { formula: `${q}D${inf.pr + 6}`, result: inf.st.weekend };
    row.getCell(6).value = { formula: `${q}E${inf.tot}`, result: inf.st.total };
    for (let cIdx = 1; cIdx <= 6; cIdx++) {
      style(row.getCell(cIdx), {
        f: cIdx === 6 ? { bold: true, color: { argb: NAVY } } : {}, fl: i % 2 ? ZEBRA : WHITE,
        al: { horizontal: cIdx === 1 ? 'left' : 'center' }, nf: cIdx >= 5 ? H_FMT : undefined,
        b: { bottom: line('thin', GRID) },
      });
    }
    row.height = 18;
  });
  const r = 5 + infos.length;
  const row = ws.getRow(r);
  row.getCell(1).value = 'UKUPNO';
  [3, 4, 5, 6].forEach((cIdx) => {
    const col = 'ABCDEF'[cIdx - 1];
    const sum = infos.reduce((a, inf) => a + [0, 0, inf.st.count, inf.st.days, inf.st.weekend, inf.st.total][cIdx - 1], 0);
    row.getCell(cIdx).value = { formula: `SUM(${col}5:${col}${r - 1})`, result: Math.round(sum * 100) / 100 };
  });
  for (let cIdx = 1; cIdx <= 6; cIdx++) {
    style(row.getCell(cIdx), { f: { bold: true, size: 11, color: { argb: WHITE } }, fl: NAVY,
      al: { horizontal: cIdx === 1 ? 'left' : 'center' }, nf: cIdx >= 5 ? H_FMT : undefined });
  }
  row.height = 22;
}

export async function buildWorkbook(doc, pids, summaryTitle) {
  await loadExcelJS();
  const wb = new window.ExcelJS.Workbook();
  wb.creator = doc.profile.name;
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const infos = pids.map((pid) => addMonthSheet(wb, doc, pid));
  if (summaryTitle && infos.length > 1) addSummarySheet(wb, doc, infos, summaryTitle);
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: Math.max(0, infos.length - 1), visibility: 'visible' }];
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
