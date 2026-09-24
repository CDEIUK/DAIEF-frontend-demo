import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'
import { useEffect, useState } from 'react'

import 'survey-core/survey-core.css'

export default function SurveyPage({ surveyJson, initialData, onDataChange, pageIndex = 0 }) {
  const pageTitle = surveyJson.pages[pageIndex]?.title ?? ''
  const pageDescription = surveyJson.pages[pageIndex]?.description ?? ''
  const [model] = useState(() => {
    const surveyModel = new Model(surveyJson)
    surveyModel.data = initialData
    surveyModel.currentPageNo = pageIndex
    return surveyModel
  })

  useEffect(() => {
    const handleValueChanged = () => onDataChange(model.data)
    model.onValueChanged.add(handleValueChanged)

    return () => model.onValueChanged.remove(handleValueChanged)
  }, [model, onDataChange])

  return (
    <>
      <h2 className="govuk-heading-l survey-page-title">{pageTitle}</h2>
      <div
        className="survey-page-description"
        dangerouslySetInnerHTML={{ __html: pageDescription }}
      />
      <Survey model={model} />
    </>
  )
}