// =====================================================
//  KA ESPORTS – API Data Loader
//  Fetches sheet data from Google Apps Script and
//  renders it into a clean HTML table with rank colors.
// =====================================================

const API_BASE = 'https://script.google.com/macros/s/AKfycbyVBjLSCxunlwsHt2Ou_grlUMUte5Z_J1t5tOICLkVknmMyIwz5HPmQxEO0yJRhuDLY/exec';

/**
 * Number of header rows to skip for each sheet type.
 * These rows contain the sheet title / subtitle and are not part of the data.
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
  'MANUAL_MATCHES': 3
};

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

/**
 * Load data from a specific sheet and render it into a table.
 * @param {string} sheetName - Name of the sheet to load.
 * @param {string} tableId - HTML id of the table element.
 * @param {number} [rankColumnIndex=5] - Zero-based index of the rank column (default 5 for leaderboards).
 */
async function loadDataIntoTable(sheetName, tableId, rankColumnIndex = 5) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="20">Loading data…</td></tr>';

  try {
    const url = `${API_BASE}?sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.error) throw new Error(json.error);

    const allRows = json.data || [];
    const skipRows = HEADER_ROWS_TO_SKIP[sheetName] || 2;

    if (allRows.length <= skipRows) {
      tbody.innerHTML = '<tr><td colspan="20">No data available.</td></tr>';
      return;
    }

    // Separate real headers and data rows
    const headerRow = allRows[skipRows - 1];  // Last skipped row is usually the real header
    const dataRows = allRows.slice(skipRows);

    // Build thead
    thead.innerHTML = '<tr>' + headerRow.map(h => `<th>${h || ''}</th>`).join('') + '</tr>';

    // Build tbody with rank classes
    tbody.innerHTML = dataRows.map(row => {
      const rankName = row[rankColumnIndex] ? String(row[rankColumnIndex]).trim() : '';
      const rankClass = RANK_CLASS_MAP[rankName] || '';
      const rowClass = rankClass ? ` class="${rankClass}"` : '';

      return `<tr${rowClass}>` + row.map(cell => `<td>${cell ?? ''}</td>`).join('') + '</tr>';
    }).join('');

  } catch (err) {
    console.error(`Error loading sheet "${sheetName}":`, err);
    tbody.innerHTML = `<tr><td colspan="20">Error: ${err.message}</td></tr>`;
  }
}
