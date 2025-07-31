import { createReadStream, createWriteStream } from 'fs';
import { createBrotliDecompress, deflate } from 'zlib';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const decompressFile = async () => {
  const source = './code/codeFiles.txt.br';
  const destination = './code/codeFiles.txt';

  await pipeline(
    createReadStream(source),
    createBrotliDecompress(),
    createWriteStream(destination)
  );

  console.log('✅ Decompression complete');
};

export default decompressFile