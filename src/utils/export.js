/**
 * Export data to CSV with UTF-8 BOM so Microsoft Excel opens Arabic text cleanly without garbled characters.
 * @param {string} filename - Target file name (e.g. students_list.csv)
 * @param {string[]} headers - Column header names in Arabic or English
 * @param {Array<Array<any>>} rows - Matrix of cell values
 */
export function exportToCSV(filename, headers, rows) {
  const bom = '\uFEFF';
  const sanitizeCell = (val) => {
    let s = String(val ?? '').replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return s;
  };

  const csvContent = bom + [
    headers.map(h => `"${sanitizeCell(h)}"`).join(','),
    ...rows.map(row => row.map(cell => `"${sanitizeCell(cell)}"`).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
