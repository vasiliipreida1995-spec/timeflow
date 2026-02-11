// Minimal QR Code generator based on qrcodegen library (public domain)
// Simplified version for URL encoding

export function generateQR(text: string): number[][] {
  const qr = QrCode.encodeText(text, Ecc.LOW);
  const size = qr.size;
  const matrix: number[][] = [];

  for (let y = 0; y < size; y++) {
    matrix[y] = [];
    for (let x = 0; x < size; x++) {
      matrix[y][x] = qr.getModule(x, y) ? 1 : 0;
    }
  }

  return matrix;
}

// QR Code generator library (simplified version)
class QrCode {
  public readonly size: number;
  private readonly modules: boolean[][] = [];

  public static encodeText(text: string, ecl: Ecc): QrCode {
    const segs = QrSegment.makeSegments(text);
    return QrCode.encodeSegments(segs, ecl);
  }

  private static encodeSegments(segs: QrSegment[], ecl: Ecc): QrCode {
    const version = 3; // Version 3: 29x29
    const qr = new QrCode(version, ecl);

    // Encode data
    const bb: boolean[] = [];
    for (const seg of segs) {
      appendBits(seg.mode.modeBits, 4, bb);
      appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
      for (const b of seg.data) bb.push(b);
    }

    // Add terminator and pad
    const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
    appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
    appendBits(0, (8 - bb.length % 8) % 8, bb);

    // Pad with alternating bytes
    for (let padByte = 0xEC; bb.length < dataCapacityBits; padByte ^= 0xEC ^ 0x11)
      appendBits(padByte, 8, bb);

    // Pack bits into bytes
    const dataCodewords: number[] = [];
    while (dataCodewords.length * 8 < bb.length)
      dataCodewords.push(0);
    bb.forEach((b, i) => dataCodewords[i >>> 3] |= (b ? 1 : 0) << (7 - (i & 7)));

    qr.drawFunctionPatterns();
    const allCodewords = qr.addEccAndInterleave(dataCodewords);
    qr.drawCodewords(allCodewords);

    qr.applyMask(0); // Use mask 0 for simplicity
    qr.drawFormatBits(0);

    return qr;
  }

  private constructor(version: number, errorCorrectionLevel: Ecc) {
    this.size = version * 4 + 17;
    this.modules = [];
    for (let i = 0; i < this.size; i++) {
      this.modules.push([]);
      for (let j = 0; j < this.size; j++)
        this.modules[i].push(false);
    }
  }

  public getModule(x: number, y: number): boolean {
    return this.modules[y][x];
  }

  private drawFunctionPatterns(): void {
    // Draw finder patterns
    for (let i = 0; i < 3; i++) {
      const x = i === 1 ? this.size - 7 : 0;
      const y = i === 2 ? this.size - 7 : 0;
      this.drawFinderPattern(x, y);
    }

    // Draw timing patterns
    for (let i = 8; i < this.size - 8; i++) {
      this.setFunctionModule(6, i, i % 2 === 0);
      this.setFunctionModule(i, 6, i % 2 === 0);
    }
  }

  private drawFinderPattern(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx + 3;
        const yy = y + dy + 3;
        if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawCodewords(data: number[]): void {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  private applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.isFunction[y][x]) {
          const invert = ((x + y) % 2 === 0); // Mask 0
          this.modules[y][x] = this.modules[y][x] !== invert;
        }
      }
    }
  }

  private drawFormatBits(mask: number): void {
    const data = 0b01 << 3 | mask; // ECC level L + mask
    let rem = data;
    for (let i = 0; i < 10; i++)
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (data << 10 | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++)
      this.setFunctionModule(8, i, getBit(bits, i));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++)
      this.setFunctionModule(14 - i, 8, getBit(bits, i));

    for (let i = 0; i < 8; i++)
      this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++)
      this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    this.setFunctionModule(8, this.size - 8, true);
  }

  private isFunction: boolean[][] = [];

  private setFunctionModule(x: number, y: number, isDark: boolean): void {
    this.modules[y][x] = isDark;
    if (!this.isFunction[y]) this.isFunction[y] = [];
    this.isFunction[y][x] = true;
  }

  private addEccAndInterleave(data: number[]): number[] {
    const version = 3;
    const ecl = Ecc.LOW;
    const numBlocks = 1;
    const blockEccLen = 15;
    const rawCodewords = Math.floor(QrCode.getNumDataCodewords(version, ecl) / numBlocks);

    const blocks: number[][] = [];
    const rsDiv = QrCode.reedSolomonComputeDivisor(blockEccLen);

    for (let i = 0; i < numBlocks; i++) {
      const dat = data.slice(i * rawCodewords, (i + 1) * rawCodewords);
      const ecc = QrCode.reedSolomonComputeRemainder(dat, rsDiv);
      blocks.push(dat.concat(ecc));
    }

    const result: number[] = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach(block => {
        if (i < block.length) result.push(block[i]);
      });
    }
    return result;
  }

  private static getNumDataCodewords(ver: number, ecl: Ecc): number {
    return Math.floor(QrCode.getNumRawDataModules(ver) / 8) -
      QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] *
      QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
  }

  private static getNumRawDataModules(ver: number): number {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  private static reedSolomonComputeDivisor(degree: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);

    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = QrCode.reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = QrCode.reedSolomonMultiply(root, 0x02);
    }
    return result;
  }

  private static reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
    const result = divisor.map(() => 0);
    for (const b of data) {
      const factor = b ^ result.shift()!;
      result.push(0);
      divisor.forEach((coef, i) => result[i] ^= QrCode.reedSolomonMultiply(coef, factor));
    }
    return result;
  }

  private static reedSolomonMultiply(x: number, y: number): number {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  private static readonly ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30],
  ];

  private static readonly NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2],
  ];
}

class Ecc {
  public static readonly LOW = new Ecc(0, 1);
  public constructor(public readonly ordinal: number, public readonly formatBits: number) {}
}

class QrSegment {
  public constructor(
    public readonly mode: Mode,
    public readonly numChars: number,
    public readonly data: boolean[]
  ) {}

  public static makeSegments(text: string): QrSegment[] {
    return [QrSegment.makeBytes(textToBytes(text))];
  }

  public static makeBytes(data: number[]): QrSegment {
    const bb: boolean[] = [];
    for (const b of data)
      appendBits(b, 8, bb);
    return new QrSegment(Mode.BYTE, data.length, bb);
  }
}

class Mode {
  public static readonly BYTE = new Mode(0x4, [8, 16, 16]);
  private constructor(public readonly modeBits: number, private readonly numBitsCharCount: number[]) {}
  public numCharCountBits(ver: number): number {
    return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
  }
}

function appendBits(val: number, len: number, bb: boolean[]): void {
  for (let i = len - 1; i >= 0; i--)
    bb.push(((val >>> i) & 1) !== 0);
}

function getBit(x: number, i: number): boolean {
  return ((x >>> i) & 1) !== 0;
}

function textToBytes(text: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < text.length; i++)
    result.push(text.charCodeAt(i));
  return result;
}
