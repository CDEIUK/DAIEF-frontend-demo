import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'
import { useEffect, useState } from 'react'

import 'survey-core/survey-core.css'

function getProgressSummary(model, pageIndex) {
  const page = model.pages[pageIndex]
  const questions = page?.elements ?? []
  const startedSeries = new Set()
  const allSeries = new Set()
  let actionCount = 0

  questions.forEach((question) => {
    const seriesMatch = question.name?.match(/^\d+/)

    if (!seriesMatch) {
      return
    }

    allSeries.add(seriesMatch[0])

    if (question.name.endsWith('S')) {
      if (question.isVisible) {
        actionCount += 1
      }
      return
    }

    const value = model.getValue(question.name)
    if (value !== undefined && value !== null && value !== '') {
      startedSeries.add(seriesMatch[0])
    }
  })

  const completedSeries = [...startedSeries].filter((series) => {
    const seriesQuestions = questions.filter((question) => (
      question.name?.match(new RegExp(`^${series}(?:[a-z]+)?$`))
      && question.isVisible
      && ['radiogroup', 'comment'].includes(question.getType())
    ))
    const allInputsProvided = seriesQuestions.length > 0 && seriesQuestions.every((question) => {
      const value = model.getValue(question.name)
      return value !== undefined && value !== null && value !== ''
    })
    const hasDisplayedAction = questions.some((question) => (
      question.name?.match(new RegExp(`^${series}[a-z]*S$`))
      && question.name.endsWith('S')
      && question.isVisible
    ))

    return allInputsProvided && !hasDisplayedAction
  }).length

  return {
    startedCount: startedSeries.size,
    actionCount,
    completedCount: completedSeries,
    totalSeriesCount: allSeries.size,
  }
}

export default function SurveyPage({ surveyJson, initialData, onDataChange, pageIndex = 0, hideCommentQuestions = false, projectName = '' }) {
  const pageTitle = surveyJson.pages[pageIndex]?.title ?? ''
  const pageDescription = surveyJson.pages[pageIndex]?.description ?? ''
  const today = new Date()
  const currentDate = [
    String(today.getDate()).padStart(2, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    today.getFullYear(),
  ].join('-')
  const [model] = useState(() => {
    const surveyModel = new Model(surveyJson)
    if (pageIndex !== 0 && hideCommentQuestions) {
      surveyModel.clearInvisibleValues = 'none'
    }
    surveyModel.data = initialData
    if (pageIndex !== 0) {
      surveyModel.pages[pageIndex]?.elements.forEach((question) => {
        if (question.getType() === 'comment' && hideCommentQuestions) {
          question.visibleIf = 'false'
          question.visible = false
        }
      })
    }
    surveyModel.currentPageNo = pageIndex
    return surveyModel
  })
  const [progressSummary, setProgressSummary] = useState(() => getProgressSummary(model, pageIndex))

  useEffect(() => {
    const handleValueChanged = () => {
      setProgressSummary(getProgressSummary(model, pageIndex))
      onDataChange(model.data)
    }
    model.onValueChanged.add(handleValueChanged)

    return () => model.onValueChanged.remove(handleValueChanged)
  }, [model, onDataChange, pageIndex])

  return (
    <section className="printable-survey">
      <div className="survey-metadata" aria-label="Form details">
        <span>Project name: {projectName?.trim() || 'Not named'}</span>
        <span>Date: {currentDate}</span>
        <span>Form version: v0.3</span>
      </div>
      <h2 className="govuk-heading-l survey-page-title">{pageTitle}</h2>
      <div
        className="survey-page-description"
        dangerouslySetInnerHTML={{ __html: pageDescription }}
      />
      {pageIndex !== 0 && (
        <section className="survey-progress-panel" aria-label="Survey progress">
          <strong className="survey-progress-label">Section progress</strong>
          <div className="survey-progress-item">
            <strong className="govuk-tag govuk-tag--yellow">Started</strong>
            <span className="survey-progress-count">{progressSummary.startedCount}/{progressSummary.totalSeriesCount}</span>
          </div>
          <div className="survey-progress-item">
            <strong className="govuk-tag govuk-tag--green">Completed</strong>
            <span className="survey-progress-count">{progressSummary.completedCount}/{progressSummary.totalSeriesCount}</span>
          </div>
          <div className="survey-progress-item">
            <strong className="govuk-tag govuk-tag--red">Actions</strong>
            <span className="survey-progress-count">{progressSummary.actionCount}</span>
          </div>
        </section>
      )}
      <div className={pageIndex === 0 ? 'survey-form survey-form--project-detail' : 'survey-form'}>
        <Survey model={model} />
      </div>
    </section>
  )
}