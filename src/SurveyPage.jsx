import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'
import surveyJson from '../daief-survey.json'

import 'survey-core/survey-core.css'

export default function SurveyPage() {
  const model = new Model(surveyJson)

  return <Survey model={model} />
}