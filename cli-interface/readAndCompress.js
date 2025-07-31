import { fileURLToPath } from 'url'
import path from 'path'
import { createWriteStream, createReadStream } from 'fs'
import fs from 'fs/promises'
import { pipeline } from 'stream/promises'
import { createBrotliCompress } from 'zlib'
import sendToServer from './send-to-server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const writeStream = createWriteStream(path.join(__dirname, 'codeFiles.txt'), { 
    flags: 'w', 
    encoding: 'utf-8' 
})

// Removing the limit of event listeners
writeStream.setMaxListeners(0)

const readAllFiles = async (dir) => {
    const folderContent = await fs.readdir(dir, {withFileTypes: true})
    const dontParse = ['node_modules', '.git', '.next', 'public', '.vercel', '.gitignore', 'package-lock.json', '.env', 'allfiles.txt', 'allfiles.txt.br', 'llm-backend']

    const folders = []
    for(const file of folderContent){
        if(dontParse.includes(file.name)) continue

        if(file.isFile()){
            const filePath = path.join(dir, file.name)

            // Data will be read here
            const readStream = createReadStream(filePath, { encoding: 'utf-8' })

            // Appending File name
            writeStream.write(`\n\n----- [${file.name}] -----\n\n`)

            // Appending data of file
            await pipeline(readStream, writeStream, {end: false})
        }

        if(file.isDirectory()){
            folders.push(file.name)
        }
    }

    // Targeting sub folder now
    for(const folder of folders){
        const folderPath = path.join(dir, folder)
        await readAllFiles(folderPath)
    }
}

readAllFiles(__dirname).then(async () => {
    writeStream.end()

    await pipeline(
        createReadStream(path.join(__dirname, 'codeFiles.txt')),
        createBrotliCompress(),
        createWriteStream(path.join(__dirname, 'codeFiles.txt.br')),
    );

    await sendToServer('codeFiles.txt.br')
})

export default readAllFiles