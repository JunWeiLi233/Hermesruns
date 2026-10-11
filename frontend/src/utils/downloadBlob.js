/** Hands a Blob to the browser as a file download. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Some browsers start the download after click() returns, so keep the URL alive briefly.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The filename in a Content-Disposition header value, or `fallback` when there is none. */
export function filenameFromDisposition(header, fallback) {
  const match = /filename="?([^";]+)"?/i.exec(header || '');
  return match ? match[1] : fallback;
}
