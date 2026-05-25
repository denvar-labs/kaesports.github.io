// js/api-loader.js – Carga datos desde Google Sheets (GitHub Pages)

const API_BASE = 'https://script.google.com/macros/s/AKfycbyVBjLSCxunlwsHt2Ou_grlUMUte5Z_J1t5tOICLkVknmMyIwz5HPmQxEO0yJRhuDLY/exec';

async function loadDataIntoTable(sheetName, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  tbody.innerHTML = '<tr><td colspan="10">Cargando...</td></tr>';

  try {
    const url = `${API_BASE}?sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.error) throw new Error(json.error);

    const rows = json.data || [];
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10">Hoja vacía.</td></tr>';
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h || ''}</th>`).join('') + '</tr>';
    tbody.innerHTML = dataRows.map(row => {
      return '<tr>' + row.map(cell => `<td>${cell ?? ''}</td>`).join('') + '</tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10">Error: ${err.message}</td></tr>`;
    console.error(err);
  }
}
