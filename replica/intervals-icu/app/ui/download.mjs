export function downloadText(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], {
      type
    })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows, keys) {
  return [keys, ...rows.map(r => keys.map(k => r[k] ?? ''))].map(row => row.map(v => {
    const text = String(v);
    return '"' + (/^[=+\-@]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
