import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { linesToRows, type OcrLine } from '../domain/ocrParse';
import { pickImagePaths } from './camera';
import { isNative } from './http';

// Free on-device text recognition (Google ML Kit, works offline).

export async function recognizeRows(path: string): Promise<string[]> {
  const res = await TextRecognition.processImage({ path });
  const lines: OcrLine[] = [];
  for (const block of res.blocks) {
    for (const line of block.lines) {
      const b = line.boundingBox;
      lines.push(b ? { text: line.text, x: b.left, y: b.top, w: b.right - b.left, h: b.bottom - b.top } : { text: line.text, x: 0, y: lines.length * 40, w: 100, h: 30 });
    }
  }
  return linesToRows(lines);
}

/** Lets the user pick screenshots and returns the recognised rows of all of them, in order. */
export async function readScreenshots(limit = 6): Promise<string[] | null> {
  if (!isNative) throw new Error('Die Texterkennung für Screenshots gibt es nur in der Android-App.');
  const paths = await pickImagePaths(limit);
  if (!paths.length) return null;
  const rows: string[] = [];
  for (const p of paths) rows.push(...(await recognizeRows(p)));
  return rows;
}
