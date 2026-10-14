import test from 'node:test';
import assert from 'node:assert/strict';

import { FILE_STATUSES, FILE_VISIBILITIES } from '../src/lib/constants/enums.ts';
import { canUploadFileVersion } from '../src/lib/files/upload-policy.ts';
import { USER_ROLES } from '../src/types/auth.ts';

const baseFile = {
  status: FILE_STATUSES.READY,
  visibility: FILE_VISIBILITIES.CLIENT_UPLOADED,
  uploadedBy: 'client-a',
};

test('admin and project-authorized employee may create a file version', () => {
  assert.equal(
    canUploadFileVersion({ id: 'admin', role: USER_ROLES.ADMIN }, baseFile),
    true
  );
  assert.equal(
    canUploadFileVersion({ id: 'employee', role: USER_ROLES.EMPLOYEE }, baseFile),
    true
  );
});

test('client may only version their own client-uploaded file', () => {
  assert.equal(
    canUploadFileVersion({ id: 'client-a', role: USER_ROLES.CLIENT }, baseFile),
    true
  );
  assert.equal(
    canUploadFileVersion({ id: 'client-b', role: USER_ROLES.CLIENT }, baseFile),
    false
  );
  assert.equal(
    canUploadFileVersion(
      { id: 'client-a', role: USER_ROLES.CLIENT },
      { ...baseFile, visibility: FILE_VISIBILITIES.CLIENT_VISIBLE }
    ),
    false
  );
});

test('archived files and marketing users cannot create versions', () => {
  assert.equal(
    canUploadFileVersion(
      { id: 'admin', role: USER_ROLES.ADMIN },
      { ...baseFile, status: FILE_STATUSES.ARCHIVED }
    ),
    false
  );
  assert.equal(
    canUploadFileVersion({ id: 'marketing', role: USER_ROLES.MARKETING }, baseFile),
    false
  );
});
