import assert from 'node:assert/strict';
import {
  clearPendingShoePhotoState,
  createPendingShoePhotoState,
} from './shoeImagePickerState.js';

assert.deepEqual(
  createPendingShoePhotoState('data:image/jpeg;base64,abc', 'tempo.jpg', 'Preview ready'),
  {
    imgPendingUploadUrl: 'data:image/jpeg;base64,abc',
    imgPendingUploadName: 'tempo.jpg',
    imgUploadStatus: 'Preview ready',
  },
  'Uploading a local shoe photo should stage the preview state.'
);

assert.deepEqual(
  clearPendingShoePhotoState('Applied'),
  {
    imgPendingUploadUrl: '',
    imgPendingUploadName: '',
    imgUploadStatus: 'Applied',
  },
  'Confirming a staged photo should clear the pending state and keep the success message.'
);

assert.deepEqual(
  clearPendingShoePhotoState(),
  {
    imgPendingUploadUrl: '',
    imgPendingUploadName: '',
    imgUploadStatus: '',
  },
  'Canceling a staged photo should fully clear the pending preview state.'
);
