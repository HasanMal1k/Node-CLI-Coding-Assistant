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

// Listen for file availability - this enables LLM processing
fileEvent.on('file-available', async () => {
    try {
        codeContent = await fs.readFile('./code/codeFiles.txt', 'utf-8');
        hasCodeFile = true;
        console.log('✅ Code files loaded - LLM is now ready to process messages');
        
        // Notify all clients that LLM is ready
        io.emit('llm-ready', { message: 'Code uploaded successfully! You can now ask questions about your code.' });
    } catch (error) {
        console.error('Error loading code file:', error);
        hasCodeFile = false;
    }
});

io.on('connection',(socket) => {
    console.log('Client Connected:', socket.id)
    console.log('Total clients:', io.engine.clientsCount)
    
    let chatContent = []

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

            // Initialize context with code files (only once per connection)
            if (chatContent.length === 0) {
                const systemContext = `You are a helpful coding assistant. Here are the user's code files:

${codeContent}

All the coding files are separated by a ----- <file-name> ---- format. Analyze the code structure, identify potential issues, and provide helpful suggestions for improvements.`;
                
                chatContent.push({ role: 'system', content: systemContext });
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
        message: hasCodeFile ? 'Code files are loaded. You can ask questions!' : 'Please upload code files to start.'
    });
})

server.listen(8080, () => console.log('Server started on 8080'))