import path from 'path'
import { createReadStream } from 'fs'
import { fileURLToPath } from 'url'
import FormData from 'form-data'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sendToServer = async (fileName) => {
    try {
        const formData = new FormData()
        formData.append('codeFile', createReadStream(path.join(__dirname, fileName)))

        console.log(`Uploading ${fileName} to server...`)
        
        const response = await axios.post('http://localhost:8080/api/file', formData, {
            headers: formData.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        })

        console.log('Upload successful:', response.data)
        
    } catch (error) {
        console.error('Upload failed:', error.message)
        if (error.response) {
            console.error('Server response:', error.response.data)
        }
    }
}

export default sendToServer