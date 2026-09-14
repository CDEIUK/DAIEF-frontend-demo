import cors from 'cors'
import express from 'express'
import { readFile } from 'node:fs/promises'

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

const surveyFile = new URL('./daief-survey.json', import.meta.url)

app.get('/api/survey', async (request, response) => {
  try {
    const surveyJson = JSON.parse(await readFile(surveyFile, 'utf8'))
    response.json(surveyJson)
  } catch (error) {
    console.error('Unable to load daief-survey.json:', error)
    response.status(500).json({ error: 'Unable to load the survey definition.' })
  }
})
app.post('/api/results', (request, response) => {
  console.log('Survey response:', request.body)
  response.sendStatus(204)
})

app.listen(port, () => console.log(`API running at http://localhost:${port}`))