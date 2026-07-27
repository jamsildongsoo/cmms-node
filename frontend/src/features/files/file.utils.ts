export const formatFileSize = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const isMimeAllowed = (
  mime: string,
  allowedMimeTypes: string[],
): boolean => {
  const normalized = mime.toLowerCase();
  return allowedMimeTypes.some((pattern) => {
    const normalizedPattern = pattern.toLowerCase();
    return normalizedPattern.endsWith('/*')
      ? normalized.startsWith(normalizedPattern.slice(0, -1))
      : normalized === normalizedPattern;
  });
};

