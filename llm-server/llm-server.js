import express from 'express';
import http from 'http'
import { Server } from 'socket.io'
import { Ollama } from 'ollama';
import router from './file-fetching.js';
import fileEvent from './event-emitter.js';
import fs from 'fs/promises';

const app = express()
const server = http.createServer(app)
const io = new Server(server)
const ollama = new Ollama({ host: 'http://localhost:11434' })

app.use('/api', router)

let hasCodeFile = false;
let codeContent = '';
let codeVersion = 0; // Track when code content changes

// Listen for file availability - this enables LLM processing
fileEvent.on('file-available', async () => {
    console.log('Received file-available event');
    try {
        // Check if file exists first
        await fs.access('./code/codeFiles.txt');
        console.log('Code file exists, reading content...');
        
        codeContent = await fs.readFile('./code/codeFiles.txt', 'utf-8');
        const contentLength = codeContent.length;
        const lineCount = codeContent.split('\n').length;
        
        hasCodeFile = true;
        codeVersion++; // Increment version when code changes
        
        console.log(`Code files loaded successfully!`);
        console.log(`Content stats: ${contentLength} characters, ${lineCount} lines`);
        console.log(`Code version: ${codeVersion}`);
        console.log(`Broadcasting to ${io.engine.clientsCount} clients`);
        
        // Show a preview of the content
        const preview = codeContent.substring(0, 300).replace(/\n/g, '\\n');
        console.log(`Content preview: ${preview}...`);
        
        // Notify all clients that LLM is ready with new code
        io.emit('llm-ready', { 
            message: 'Code uploaded successfully! You can now ask questions about your code.',
            codeVersion: codeVersion
        });
        
        console.log('📡 llm-ready event broadcast complete');
        
    } catch (error) {
        console.error('Error loading code file:', error.message);
        console.error('Error details:', error);
        hasCodeFile = false;
    }
});

io.on('connection',(socket) => {
    console.log('Client Connected:', socket.id)
    console.log('Total clients:', io.engine.clientsCount)
    
    let chatContent = []
    let lastCodeVersion = 0; // Track the code version this socket has

    socket.on('message', async (data) => {
        try {
            // Only process if we have code files
            if (!hasCodeFile) {
                socket.emit('stream_chunk', {
                    data: 'Please upload your code files first before asking questions. The LLM needs your code as context to help you.\n\n',
                    isComplete: true,
                    error: false
                });
                return; 
            }

            // Reset chat content if code has been updated
            if (codeVersion > lastCodeVersion) {
                console.log(`Updating context for socket ${socket.id} (version ${lastCodeVersion} -> ${codeVersion})`);
                chatContent = []; // Reset chat history when new code is uploaded
                lastCodeVersion = codeVersion;
            }

            // Initialize or reinitialize context with current code files
            if (chatContent.length === 0) {
                if (!codeContent || codeContent.trim().length === 0) {
                    console.log(`Empty code content for socket ${socket.id}`);
                    socket.emit('stream_chunk', {
                        data: 'Error: Code content is empty. Please try uploading your files again.\n\n',
                        isComplete: true,
                        error: false
                    });
                    return;
                }

                const systemContext = `You are a helpful coding assistant. Here are the user's code files:

${codeContent}

All the coding files are separated by a ----- <file-name> ---- format. Analyze the code structure, identify potential issues, and provide helpful suggestions for improvements.`;
                
                chatContent.push({ role: 'system', content: systemContext });
                console.log(`System context initialized for socket ${socket.id} with code version ${codeVersion}`);
                console.log(`Context length: ${systemContext.length} characters`);
            }

            // Add user message
            const userQuery = { role: 'user', content: data }
            chatContent.push(userQuery)

            const response = await ollama.chat({
                model: 'deepseek-r1:8b',
                messages: chatContent,
                stream: true
            })

            let aiResponse = ''

            for await (const chunk of response) {
                const responseData = chunk.message.content
                aiResponse += responseData

                socket.emit('stream_chunk', {
                    data: responseData,
                    isComplete: false,
                    error: false
                })
            }

            // Save AI response to chat history
            const aiQuery = { role: 'assistant', content: aiResponse }
            chatContent.push(aiQuery)

            socket.emit('stream_chunk', {
                data: '',
                isComplete: true,
                error: false
            })

        } catch(error) {
            socket.emit('stream_chunk', {
                data: '',
                isComplete: true,
                error: error.message
            })
            console.log('LLM Error:', error)
        }
    })

    // Send current status to newly connected clients
    socket.emit('connection-status', { 
        hasCodeFile,
        message: hasCodeFile ? 'Code files are loaded. You can ask questions!' : 'Please upload code files to start.',
        codeVersion: codeVersion
    });
})

// Health check endpoint for Docker
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', hasCodeFile, codeVersion });
});

server.listen(8080, () => console.log('Server started on 8080'))