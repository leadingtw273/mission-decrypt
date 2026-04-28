import '@testing-library/jest-dom/vitest';
import { installIndexedDbStub, resetIndexedDbStub } from './idb-stub';

installIndexedDbStub();
beforeEach(() => {
  resetIndexedDbStub();
});
