const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DIGITS = '0123456789';

export function randomMissionId(): string {
  const buf = new Uint8Array(11);
  crypto.getRandomValues(buf);
  const pick = (alphabet: string, byte: number) => alphabet[byte % alphabet.length]!;
  return [
    pick(LETTERS, buf[0]!),
    pick(LETTERS, buf[1]!),
    pick(LETTERS, buf[2]!),
    '-',
    pick(ALPHANUM, buf[3]!),
    pick(ALPHANUM, buf[4]!),
    pick(ALPHANUM, buf[5]!),
    pick(ALPHANUM, buf[6]!),
    pick(ALPHANUM, buf[7]!),
    '-',
    pick(LETTERS, buf[8]!),
    pick(LETTERS, buf[9]!),
    pick(DIGITS, buf[10]!),
  ].join('');
}
