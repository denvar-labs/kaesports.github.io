// =====================================================
//  KA ESPORTS – API Data Loader (Extended)
//  Fetches sheet data from Google Apps Script and
//  renders tables, dropdowns, and text content.
// =====================================================

const API_BASE = 'https://script.google.com/macros/s/AKfycbyVBjLSCxunlwsHt2Ou_grlUMUte5Z_J1t5tOICLkVknmMyIwz5HPmQxEO0yJRhuDLY/exec';

/**
 * Number of header rows to skip for each sheet type.
 */
const HEADER_ROWS_TO_SKIP = {
  'LEADERBOARD_GLOBAL': 3,
  'PLAYERS': 2,
  'MATCHES': 2,
  'PENALTIES': 2,
  'ANTI_SMURF_LOG': 2,
  'AUDIT_LOG': 2,
  'SYSTEM_METRICS': 2,
  'SEASONS_REPORT': 2,
  'MANUAL_MATCHES': 3,
  'FAQ': 0,          // FAQ is not a table, we'll handle separately
  'PLAYER_H2H_DETAILS': 1  // special sheet with merged headers
};

// Default number of rows to skip if not specified
const DEFAULT_SKIP = 2;

/**
 * Mapping from rank name to CSS class for coloring table rows.
 */
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

/**
 * Fetch raw sheet data from the API.
 * @param {string} sheetName
 * @returns {Promise<Array>} raw rows
 */
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
 * Load a sheet into an HTML table, skipping metadata rows and applying rank colors.
 * @param {string} sheetName
 * @param {string} tableId - ID of the <table> element
 * @param {number} [rankColumnIndex=5] - column index for rank (0-based)
 */
async function loadTableFromSheet(sheetName, tableId, rankColumnIndex = 5) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="20">Loading data…</td></tr>';

  try {
    const allRows = await fetchSheetData(sheetName);
    const skipRows = HEADER_ROWS_TO_SKIP[sheetName] ?? DEFAULT_SKIP;

    if (allRows.length <= skipRows) {
      tbody.innerHTML = '<tr><td colspan="20">No data available.</td></tr>';
      return;
    }

    const headerRow = allRows[skipRows - 1];  // last skipped row is the real header
    const dataRows = allRows.slice(skipRows);

    thead.innerHTML = '<tr>' + headerRow.map(h => `<th>${h || ''}</th>`).join('') + '</tr>';

    tbody.innerHTML = dataRows.map(row => {
      const rankName = rankColumnIndex >= 0 ? String(row[rankColumnIndex] || '').trim() : '';
      const rankClass = RANK_CLASS_MAP[rankName] || '';
      const rowClass = rankClass ? ` class="${rankClass}"` : '';
      return `<tr${rowClass}>` + row.map(cell => `<td>${cell ?? ''}</td>`).join('') + '</tr>';
    }).join('');
  } catch (err) {
    console.error(`Error loading sheet "${sheetName}":`, err);
    tbody.innerHTML = `<tr><td colspan="20">Error: ${err.message}</td></tr>`;
  }
}

// ==================== SHEET LIST ====================

/**
 * Fetches the names of all available sheets.
 * @returns {Promise<string[]>}
 */
async function fetchSheetList() {
  const url = `${API_BASE}?list=1`;
  const response = await fetch(url);
  const json = await response.json();
  return json.sheets || [];
}

/**
 * Populates a <select> element with sheet names that match a given prefix.
 * @param {string} selectId
 * @param {string} prefix - e.g. "LEADERBOARD_" or "MATCH_REPORTS_"
 */
async function populateMonthSelector(selectId, prefix) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    const allSheets = await fetchSheetList();
    const filtered = allSheets
      .filter(name => name.startsWith(prefix))
      .sort()
      .reverse(); // newest first

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

// ==================== PLAIN TEXT RENDERER ====================

/**
 * Loads a sheet and renders its content as plain text (for FAQ etc.)
 * @param {string} sheetName
 * @param {string} containerId - ID of a <div> or <pre>
 */
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
    // For FAQ, the text is in the first column, with possible merged cells; just join rows
    const lines = allRows.map(row => row[0] || '').filter(line => line.trim() !== '');
    container.innerHTML = lines.map(line => `<p>${line}</p>`).join('');
  } catch (err) {
    container.textContent = `Error: ${err.message}`;
  }
}
