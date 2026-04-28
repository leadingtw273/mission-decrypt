export interface PickedImage {
  bytes: Uint8Array;
  mimeType: string;
  altText: string;
}

export async function fileToPickedImage(file: File, altText: string): Promise<PickedImage> {
  const buffer = await readFileAsArrayBuffer(file);

  return {
    bytes: new Uint8Array(buffer),
    mimeType: file.type,
    altText,
  };
}

export async function pickImage(altText: string): Promise<PickedImage> {
  return new Promise<PickedImage>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;

    const cleanup = () => {
      input.removeEventListener('change', handleChange);
      input.remove();
    };

    const handleChange = async () => {
      const file = input.files?.item(0);
      if (!file) {
        cleanup();
        reject(new Error('No image selected'));
        return;
      }

      try {
        const pickedImage = await fileToPickedImage(file, altText);
        cleanup();
        resolve(pickedImage);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    input.addEventListener('change', handleChange);
    document.body.appendChild(input);
    input.click();
  });
}

async function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('Failed to read file'));
        return;
      }
      resolve(reader.result);
    };

    reader.readAsArrayBuffer(file);
  });
}
