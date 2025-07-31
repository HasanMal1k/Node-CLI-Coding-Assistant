import path from 'path'
import { createReadStream } from 'fs'
import { fileURLToPath } from 'url'
import FormData from 'form-data'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sendToServer = async (filePath) => {
    try {
        const formData = new FormData()
        
        // Handle both absolute and relative paths
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath)
        
        formData.append('codeFile', createReadStream(absolutePath))

        console.log(` Uploading compressed codebase to server...`)
        
        const response = await axios.post('http://localhost:8080/api/file', formData, {
            headers: formData.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 30000 // 30 second timeout
        })

        console.log(' Upload successful:', response.data.message)
        
    } catch (error) {
        console.error(' Upload failed:', error.message)
        if (error.response) {
            console.error('Server response:', error.response.data)
        }
        throw error // Re-throw to handle in calling function
    }
}

export default sendToServer