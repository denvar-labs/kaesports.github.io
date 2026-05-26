// =====================================================
//  KA ESPORTS – API Data Loader (FIXED v3)
//  - Correct skipRows for PLAYERS (1)
//  - Percentage formatting for columns with '%' in header
//  - Always shows table headers
//  - Provides fetchPlayerNames() for H2H
// =====================================================

const API_BASE = 'https://script.google.com/macros/s/AKfycbyVBjLSCxunlwsHt2Ou_grlUMUte5Z_J1t5tOICLkVknmMyIwz5HPmQxEO0yJRhuDLY/exec';

/**
 * Number of metadata rows to skip for each sheet type.
 * The last skipped row is used as the real column header.
 */
const HEADER_ROWS_TO_SKIP = {
  'LEADERBOARD_GLOBAL': 3,
  'PLAYERS': 1,           // <-- CORREGIDO: solo 1 fila de encabezados, sin título fusionado
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

// ==================== CORE FETCH ====================

async function fetchSheetData(sheetName) {
  const url = `${API_BASE}?sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(json.error);
  return json.data || [];
}

// ==================== TABLE RENDERER ====================

/**
 * Load a sheet into an HTML table with smart formatting.
 * @param {string} sheetName
 * @param {string} tableId
 * @param {number} [rankColumnIndex=5] - column index for rank (0-based), -1 to disable
 */
async function loadTableFromSheet(sheetName, tableId, rankColumnIndex = 5) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="20">Loading…</td></tr>';

  try {
    const allRows = await fetchSheetData(sheetName);
    const skipRows = HEADER_ROWS_TO_SKIP[sheetName] ?? DEFAULT_SKIP;

    // Determine header row
    let headerRow = [];
    if (allRows.length >= skipRows && skipRows > 0) {
      headerRow = allRows[skipRows - 1].map(h => h || '');
    }

    // Build table head (always show if we have headers)
    thead.innerHTML = headerRow.length
      ? '<tr>' + headerRow.map(h => `<th>${h}</th>`).join('') + '</tr>'
      : '';

    // Data rows start after skipRows
    const dataRows = allRows.slice(skipRows);

    if (dataRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="20">No data available.</td></tr>';
      return;
    }

    // Identify columns that contain percentages (look for '%' in header)
    const percentColumns = new Set();
    headerRow.forEach((h, idx) => {
      if (typeof h === 'string' && h.includes('%')) percentColumns.add(idx);
    });

    tbody.innerHTML = dataRows.map(row => {
      const rankName = rankColumnIndex >= 0 ? String(row[rankColumnIndex] || '').trim() : '';
      const rankClass = RANK_CLASS_MAP[rankName] || '';
      const rowClass = rankClass ? ` class="${rankClass}"` : '';
      return `<tr${rowClass}>` + row.map((cell, colIdx) => {
        let display = cell ?? '';
        // Format percentage columns
        if (percentColumns.has(colIdx) && typeof cell === 'number') {
          display = (cell * 100).toFixed(1) + '%';
        } else if (typeof cell === 'number') {
          if (!Number.isInteger(cell)) {
            display = parseFloat(cell.toFixed(2));
          }
        }
        return `<td>${display}</td>`;
      }).join('') + '</tr>';
    }).join('');
  } catch (err) {
    console.error(`Error loading sheet "${sheetName}":`, err);
    tbody.innerHTML = `<tr><td colspan="20">Error: ${err.message}</td></tr>`;
  }
}

// ==================== SHEET LIST & DROPDOWNS ====================

async function fetchSheetList() {
  const url = `${API_BASE}?list=1`;
  const response = await fetch(url);
  const json = await response.json();
  return json.sheets || [];
}

/**
 * Populate a <select> with sheet names matching a prefix.
 */
async function populateMonthSelector(selectId, prefix) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    const allSheets = await fetchSheetList();
    const filtered = allSheets
      .filter(name => name.startsWith(prefix))
      .sort()
      .reverse();

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
    select.innerHTML = '<option value="">Error loading months</option>';
  }
}

/**
 * Populate any <select> with a list of strings.
 */
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

// ==================== PLAYER NAMES HELPER ====================

/**
 * Fetches the PLAYERS sheet and returns a sorted list of player names.
 * @returns {Promise<string[]>}
 */
async function fetchPlayerNames() {
  try {
    const playersSheet = await fetchSheetData('PLAYERS');
    // PLAYERS sheet: header row at index 0, data from index 1
    if (playersSheet.length < 2) return [];
    const header = playersSheet[0]; // real header
    const nameCol = header.indexOf('Name');
    if (nameCol === -1) return [];
    const dataRows = playersSheet.slice(1);
    const names = dataRows.map(row => row[nameCol]).filter(Boolean);
    return [...new Set(names)].sort();
  } catch (err) {
    console.error('Error fetching player names:', err);
    return [];
  }
}

// ==================== PLAIN TEXT RENDERER ====================

async function loadPlainText(sheetName, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.textContent = 'Loading…';

  try {
    const allRows = await fetchSheetData(sheetName);
    if (!allRows.length) {
      container.textContent = 'No content found.';
      return;
    }
    const lines = allRows.map(row => row[0] || '').filter(line => line.trim() !== '');
    container.innerHTML = lines.map(line => `<p>${line}</p>`).join('');
  } catch (err) {
    container.textContent = `Error: ${err.message}`;
  }
}
