import { describe, expect, it, vi } from 'vitest';

import { fileToPickedImage, pickImage } from './pickImage';

function createFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* iterator() {
      yield* files;
    },
  } as FileList & Iterable<File>;

  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, {
      configurable: true,
      enumerable: true,
      value: file,
    });
  });

  return fileList;
}

describe('fileToPickedImage', () => {
  it('converts a File into PickedImage', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const file = new File([bytes], 'test.jpg', { type: 'image/jpeg' });

    const pickedImage = await fileToPickedImage(file, 'Test image');

    expect(pickedImage).toEqual({
      bytes,
      mimeType: 'image/jpeg',
      altText: 'Test image',
    });
  });
});

describe('pickImage', () => {
  it('picks an image from a hidden file input', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'picked.png', { type: 'image/png' });
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click(this: HTMLInputElement) {
      Object.defineProperty(this, 'files', {
        configurable: true,
        value: createFileList([file]),
      });
      this.dispatchEvent(new Event('change'));
    });

    const pickedImage = await pickImage('Chosen file');

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(pickedImage).toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      altText: 'Chosen file',
    });
  });

  it('rejects when the user does not choose a file', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click(this: HTMLInputElement) {
      Object.defineProperty(this, 'files', {
        configurable: true,
        value: createFileList([]),
      });
      this.dispatchEvent(new Event('change'));
    });

    await expect(pickImage('Missing file')).rejects.toThrow(/no image selected/i);
  });
});
