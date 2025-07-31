import express from "express";
import multer from "multer";
import decompressFile from "./brotli-decompress.js";
import fileEvent from "./event-emitter.js";

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

    res.json({
        status: 'success',
        message: 'Code file uploaded and processing...',
        savedAs: req.file.filename,
        originalName: req.file.originalname
    });

    try {
        // First decompress the uploaded file
        await decompressFile();
        console.log('File decompressed successfully');
        
        // Then signal that code is available for LLM
        fileEvent.emit('file-available');
        console.log('LLM context updated with new code files');
        
    } catch (error) {
        console.error('Error processing code file:', error);
    }
})

export default router;