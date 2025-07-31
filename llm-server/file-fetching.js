import express from "express";
import multer from "multer";
import decompressFile from "./brotli-decompress.js";
import fileEvent from "./event-emitter.js";
import fs from 'fs/promises';

const router = express.Router()

const upload = multer({
    storage: multer.diskStorage({
        destination: './code',
        filename: (req, file, cb) => {
            cb(null, file.originalname)  
        }
    })
})

router.post('/file', upload.single('codeFile'), async (req, res) => {
    console.log('Code file received:', req.file?.originalname)

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Send response immediately
    res.json({
        status: 'success',
        message: 'Code file uploaded and processing...',
        savedAs: req.file.filename,
        originalName: req.file.originalname
    });

    try {
        // Verify file was saved
        const uploadedFile = `./code/${req.file.filename}`;
        const stats = await fs.stat(uploadedFile);
        console.log(`Uploaded file size: ${stats.size} bytes`);

        // First decompress the uploaded file
        console.log('Starting decompression...');
        await decompressFile();
        console.log('File decompressed successfully');
        
        // Then signal that code is available for LLM
        console.log('Emitting file-available event...');
        fileEvent.emit('file-available');
        console.log('LLM context update signal sent');
        
    } catch (error) {
        console.error('Error processing code file:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
    }
})

export default router;