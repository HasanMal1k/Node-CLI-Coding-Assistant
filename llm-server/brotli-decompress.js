import { createReadStream, createWriteStream } from 'fs';
import { createBrotliDecompress } from 'zlib';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const decompressFile = async () => {
  const source = './code/codeFiles.txt.br';
  const destination = './code/codeFiles.txt';

  try {
    // Check if source file exists
    await fs.access(source);
    console.log('Found compressed file, starting decompression...');

    await pipeline(
      createReadStream(source),
      createBrotliDecompress(),
      createWriteStream(destination)
    );

    // Verify the decompressed file
    const stats = await fs.stat(destination);
    console.log(`Decompression complete - File size: ${stats.size} bytes`);

    // Log a preview of the content to verify it's correct
    const content = await fs.readFile(destination, 'utf-8');
    const preview = content.substring(0, 200);
    console.log('Content preview:', preview + '...');

    return true;
  } catch (error) {
    console.error('Decompression failed:', error.message);
    console.error('Source file:', source);
    console.error('Destination:', destination);
    throw error;
  }
};

export default decompressFile