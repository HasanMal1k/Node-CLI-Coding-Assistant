import { fileURLToPath } from 'url'
import path from 'path'
import { createWriteStream, createReadStream } from 'fs'
import fs from 'fs/promises'
import { pipeline } from 'stream/promises'
import { createBrotliCompress } from 'zlib'
import sendToServer from './send-to-server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Function to read all files from a specific directory
const readAllFiles = async (targetDir) => {
    // Create output files in a temp directory within CLI folder
    const outputPath = path.join(__dirname, 'temp')
    await fs.mkdir(outputPath, { recursive: true })
    
    const txtFile = path.join(outputPath, 'codeFiles.txt')
    const brFile = path.join(outputPath, 'codeFiles.txt.br')
    
    const writeStream = createWriteStream(txtFile, { 
        flags: 'w', 
        encoding: 'utf-8' 
    })

    // Removing the limit of event listeners
    writeStream.setMaxListeners(0)

    const dontParse = [
        'node_modules', '.git', '.next', 'public', '.vercel', 
        '.gitignore', 'package-lock.json', '.env', 
        'allfiles.txt', 'allfiles.txt.br', 'llm-backend',
        'dist', 'build', '.cache', 'coverage', '.nyc_output',
        'temp', 'tmp', '.DS_Store', 'Thumbs.db'
    ]

    const readDirectory = async (dir) => {
        try {
            const folderContent = await fs.readdir(dir, {withFileTypes: true})
            const folders = []

            for(const file of folderContent){
                if(dontParse.includes(file.name)) continue

                if(file.isFile()){
                    const filePath = path.join(dir, file.name)
                    
                    // Check if file is a code file (you can extend this list)
                    const codeExtensions = [
                        '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', 
                        '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
                        '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
                        '.json', '.xml', '.yml', '.yaml', '.toml', '.ini', '.config',
                        '.md', '.txt', '.sql', '.sh', '.bat', '.ps1'
                    ]
                    
                    const ext = path.extname(file.name).toLowerCase()
                    const isCodeFile = codeExtensions.includes(ext) || 
                                     ['Dockerfile', 'Makefile', 'README', 'LICENSE'].includes(file.name)

                    if (isCodeFile) {
                        try {
                            // Get relative path for better organization
                            const relativePath = path.relative(targetDir, filePath)
                            
                            // Data will be read here
                            const readStream = createReadStream(filePath, { encoding: 'utf-8' })

                            // Appending File name with relative path
                            writeStream.write(`\n\n----- [${relativePath}] -----\n\n`)

                            // Appending data of file
                            await pipeline(readStream, writeStream, {end: false})
                        } catch (fileError) {
                            console.warn(`Could not read file ${filePath}:`, fileError.message)
                        }
                    }
                }

                if(file.isDirectory()){
                    folders.push(file.name)
                }
            }

            // Process subdirectories
            for(const folder of folders){
                const folderPath = path.join(dir, folder)
                await readDirectory(folderPath)
            }
        } catch (error) {
            console.warn(`Could not read directory ${dir}:`, error.message)
        }
    }

    // Start reading from the target directory
    await readDirectory(targetDir)
    
    // Close the write stream
    await new Promise((resolve) => {
        writeStream.end(resolve)
    })

    // Compress the file
    await pipeline(
        createReadStream(txtFile),
        createBrotliCompress(),
        createWriteStream(brFile)
    )

    console.log(`✅ Compressed ${path.basename(targetDir)} codebase`)

    // Send to server
    await sendToServer(brFile)
    
    // Clean up temp files
    try {
        await fs.unlink(txtFile)
        await fs.unlink(brFile)
    } catch (cleanupError) {
        console.warn('Could not clean up temp files:', cleanupError.message)
    }
}

export default readAllFiles