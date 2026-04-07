export function createPendingShoePhotoState(dataUrl, fileName, readyMessage) {
  return {
    imgPendingUploadUrl: dataUrl || '',
    imgPendingUploadName: fileName || '',
    imgUploadStatus: readyMessage || '',
  };
}

export function clearPendingShoePhotoState(statusMessage = '') {
  return {
    imgPendingUploadUrl: '',
    imgPendingUploadName: '',
    imgUploadStatus: statusMessage,
  };
}
