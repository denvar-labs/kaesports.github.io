// =====================================================
//  KA ESPORTS – API Data Loader (v10 – Auto-detect header row)
// =====================================================

const API_BASE = 'https://script.google.com/macros/s/AKfycbyVBjLSCxunlwsHt2Ou_grlUMUte5Z_J1t5tOICLkVknmMyIwz5HPmQxEO0yJRhuDLY/exec';

const HEADER_ROWS_TO_SKIP = {
  'LEADERBOARD_GLOBAL': 3,
  'PLAYERS': 1,
  'MATCHES': 2,
  'PENALTIES': 2,
  'ANTI_SMURF_LOG': 2,
  'AUDIT_LOG': 2,
  'SYSTEM_METRICS': 2,
  'SEASONS_REPORT': 2,
  'MANUAL_MATCHES': 3,
  'FAQ': 0,
  'PLAYER_H2H_DETAILS': 1,
  '_H2H_DATA': 1
};

const DEFAULT_SKIP = 2;

const RANK_CLASS_MAP = {
  'Grand Master': 'rank-grand-master',
  'Master': 'rank-master',
  'Pro': 'rank-pro',
  'Expert': 'rank-expert',
  'Advanced': 'rank-advanced',
  'Amateur': 'rank-amateur',
  'Padawan': 'rank-padawan'
};

const RATING_THRESHOLDS = [
  { rank: 'Grand Master', min: 2000 },
  { rank: 'Master',       min: 1800 },
  { rank: 'Pro',          min: 1600 },
  { rank: 'Expert',       min: 1400 },
  { rank: 'Advanced',     min: 1200 },
  { rank: 'Amateur',      min: 1000 },
  { rank: 'Padawan',      min: 0 }
];

function getRankFromRating(rating) {
  const r = Number(rating);
  for (const level of RATING_THRESHOLDS) {
    if (r >= level.min) return level.rank;
  }
  return 'Padawan';
}

async function fetchSheetData(sheetName) {
  const url = `${API_BASE}?sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(json.error);
  return json.data || [];
}

// ------------------------------------------------------------------
//  NUEVA FUNCIÓN: encontrar la fila que contiene los encabezados reales
// ------------------------------------------------------------------
function detectHeaderRow(allRows, isMatchReport = false) {
  // Buscamos la primera fila que contenga "Player" (para match reports)
  // o simplemente la primera fila no vacía que tenga más de 2 celdas con texto.
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i].map(cell => (cell || '').toString().trim());
    // Para Match Reports: buscamos la palabra "Player" en cualquier celda
    if (isMatchReport && row.some(cell => cell.toLowerCase().includes('player'))) {
      return i;
    }
    // Si la fila tiene al menos 3 celdas con contenido, asumimos que es el encabezado
    const nonEmpty = row.filter(cell => cell.length > 0).length;
    if (nonEmpty >= 3) {
      return i;
    }
  }
  // Fallback: si no se encuentra, devolvemos -1 para usar el comportamiento antiguo
  return -1;
}

async function loadTableFromSheet(sheetName, tableId, rankColumnIndex = 5) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="20">Loading…</td></tr>';

  try {
    const allRows = await fetchSheetData(sheetName);
    if (allRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="20">No data available.</td></tr>';
      return;
    }

    const isMatchReport = sheetName.startsWith('MATCH_REPORTS_');

    // Intentar detectar automáticamente la fila de encabezados
    const detectedIndex = detectHeaderRow(allRows, isMatchReport);
    let headerRowIndex = -1;
    if (detectedIndex >= 0) {
      headerRowIndex = detectedIndex;
      console.log(`🔍 Auto-detected header row at index ${detectedIndex}`);
    } else {
      // Fallback al número predefinido de filas a saltar
      const skipRows = HEADER_ROWS_TO_SKIP[sheetName] || (isMatchReport ? 3 : DEFAULT_SKIP);
      headerRowIndex = skipRows - 1;
      console.log(`⚠️ Using fallback header row index: ${headerRowIndex}`);
    }

    let headerRow = [];
    if (headerRowIndex >= 0 && allRows.length > headerRowIndex) {
      headerRow = allRows[headerRowIndex].map(h =>
        (h || '').toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
      );
    }

    thead.innerHTML = headerRow.length
      ? '<tr>' + headerRow.map(h => `<th>${h}</th>`).join('') + '</tr>'
      : '';

    // Las filas de datos empiezan justo después de la fila de encabezados
    const dataStartIndex = headerRowIndex + 1;
    const dataRows = allRows.slice(dataStartIndex).filter(row => {
      const firstCell = (row[0] || '').toString().trim();
      return firstCell !== '---' && firstCell !== '' && firstCell !== 'undefined';
    });

    if (dataRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="20">No data available.</td></tr>';
      return;
    }

    const percentColumns = new Set();
    headerRow.forEach((h, idx) => {
      if (h.includes('%')) percentColumns.add(idx);
    });

    let playerColIndex = -1, ratingBeforeColIndex = -1;
    if (isMatchReport) {
      playerColIndex = headerRow.findIndex(h => h.includes('Player'));
      ratingBeforeColIndex = headerRow.findIndex(h => h.includes('Rating Before'));
      console.log('📊 Match Report headers:', headerRow);
      console.log('   Player column index:', playerColIndex, '| Rating Before index:', ratingBeforeColIndex);
    }

    tbody.innerHTML = dataRows.map(row => {
      let rowClass = '';
      if (!isMatchReport && rankColumnIndex >= 0) {
        const rankName = String(row[rankColumnIndex] || '').trim();
        rowClass = RANK_CLASS_MAP[rankName] || '';
      }

      let rowHTML = `<tr class="${rowClass}">`;
      row.forEach((cell, colIdx) => {
        let display = cell ?? '';
        if (percentColumns.has(colIdx) && typeof cell === 'number') {
          display = (cell * 100).toFixed(1) + '%';
        } else if (typeof cell === 'number' && !Number.isInteger(cell)) {
          display = parseFloat(cell.toFixed(2));
        }

        let cellStyle = '';
        if (isMatchReport && colIdx === playerColIndex && ratingBeforeColIndex >= 0) {
          const ratingBefore = parseFloat(row[ratingBeforeColIndex]);
          if (!isNaN(ratingBefore)) {
            const rank = getRankFromRating(ratingBefore);
            const cssClass = RANK_CLASS_MAP[rank] || '';
            cellStyle = ` class="${cssClass}"`;
          }
        }

        rowHTML += `<td${cellStyle}>${display}</td>`;
      });
      rowHTML += '</tr>';
      return rowHTML;
    }).join('');
  } catch (err) {
    console.error(`Error loading sheet "${sheetName}":`, err);
    tbody.innerHTML = `<tr><td colspan="20">Error: ${err.message}</td></tr>`;
  }
}

// ----- Helper functions (unchanged) -----
async function fetchSheetList() {
  const url = `${API_BASE}?list=1`;
  const response = await fetch(url);
  const json = await response.json();
  return json.sheets || [];
}

async function populateMonthSelector(selectId, prefix) {
  const select = document.getElementById(selectId);
  if (!select) return;
  try {
    const allSheets = await fetchSheetList();
    const filtered = allSheets.filter(name => name.startsWith(prefix)).sort().reverse();
    select.innerHTML = '<option value="">-- Select a month --</option>';
    filtered.forEach(name => {
      const display = name.replace(prefix, '').replace(/_/g, '-');
      const option = document.createElement('option');
      option.value = name;
      option.textContent = display;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error populating month selector:', err);
  }
}

function populateSelectFromList(selectId, items, defaultText = '-- Select --') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">${defaultText}</option>`;
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

async function fetchPlayerNames() {
  try {
    const playersSheet = await fetchSheetData('PLAYERS');
    if (playersSheet.length < 2) return [];
    const header = playersSheet[0].map(h => (h || '').toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim());
    const nameCol = header.indexOf('Name');
    if (nameCol === -1) return [];
    const names = playersSheet.slice(1).map(row => row[nameCol]).filter(Boolean);
    return [...new Set(names)].sort();
  } catch (err) {
    console.error('Error fetching player names:', err);
    return [];
  }
}

async function loadPlainText(sheetName, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.textContent = 'Loading…';
  try {
    const allRows = await fetchSheetData(sheetName);
    if (!allRows.length) { container.textContent = 'No content found.'; return; }
    const lines = allRows.map(row => row[0] || '').filter(line => line.trim() !== '');
    container.innerHTML = lines.map(line => `<p>${line}</p>`).join('');
  } catch (err) {
    container.textContent = `Error: ${err.message}`;
  }
}
