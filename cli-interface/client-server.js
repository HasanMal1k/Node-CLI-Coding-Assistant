import express from 'express'
import { io as Client } from 'socket.io-client'

const app = express()

export const socket = Client('http://localhost:8080')

socket.on('connect', () => {
    console.log(' Connected to LLM server') 
})

socket.on('disconnect', () => {
    console.log(' Disconnected from LLM server')
})

socket.on('connect_error', (error) => {
    console.error(' Connection failed:', error.message)
})

// Send message to LLM
export const sendMessage = (message) => {
    socket.emit('message', message)
}