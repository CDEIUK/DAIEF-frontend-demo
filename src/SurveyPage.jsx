import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'
import { useEffect, useRef, useState } from 'react'

import 'survey-core/survey-core.css'

function getCompletedSeries(model, questions) {
  const startedSeries = new Set()

  questions.forEach((question) => {
    const seriesMatch = question.name?.match(/^\d+/)
    if (!seriesMatch || question.name.endsWith('S')) {
      return
    }

    const value = model.getValue(question.name)
    if (value !== undefined && value !== null && value !== '') {
      startedSeries.add(seriesMatch[0])
    }
  })

  return new Set([...startedSeries].filter((series) => {
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
  }))
}

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

    if (question.isVisible) {
      allSeries.add(seriesMatch[0])
    }

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

  return {
    startedCount: startedSeries.size,
    actionCount,
    completedCount: getCompletedSeries(model, questions).size,
    totalSeriesCount: allSeries.size,
  }
}

export default function SurveyPage({ surveyJson, initialData, sharedData, onDataChange, onNavigateToProjectDetail, pageIndex = 0, hideCommentQuestions = false, projectName = '' }) {
  const pageTitle = surveyJson.pages[pageIndex]?.title ?? ''
  const pageDescription = surveyJson.pages[pageIndex]?.description ?? ''
  const hasSelectedFilters = Array.isArray(sharedData?.FILTER) && sharedData.FILTER.length > 0
  const showNoFiltersMessage = pageIndex !== 0 && !hasSelectedFilters
  const today = new Date()
  const currentDate = [
    String(today.getDate()).padStart(2, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    today.getFullYear(),
  ].join('-')
  const renderedQuestions = useRef(new Map())
  const [model] = useState(() => {
    const surveyModel = new Model(surveyJson)
    if (pageIndex !== 0 && hideCommentQuestions) {
      surveyModel.clearInvisibleValues = 'none'
    }
    surveyModel.data = { ...initialData, ...sharedData }
    if (pageIndex !== 0) {
      surveyModel.pages[pageIndex]?.elements.forEach((question) => {
        if (question.getType() === 'comment' && hideCommentQuestions) {
          question.visibleIf = 'false'
          question.visible = false
        }
      })
    }
    surveyModel.currentPageNo = pageIndex

    const refreshCompletedQuestionStyles = () => {
      const questions = surveyModel.pages[pageIndex]?.elements ?? []
      const completedSeries = getCompletedSeries(surveyModel, questions)

      renderedQuestions.current.forEach((element, name) => {
        const question = surveyModel.getQuestionByName(name)
        const series = name.match(/^\d+/)?.[0]
        element.classList.toggle(
          'survey-question--completed',
          question?.getType() === 'radiogroup' && Boolean(series && completedSeries.has(series)),
        )
      })
    }

    let completionStyleFrame
    const scheduleCompletedQuestionStyleRefresh = () => {
      if (completionStyleFrame !== undefined) {
        window.cancelAnimationFrame(completionStyleFrame)
      }
      completionStyleFrame = window.requestAnimationFrame(() => {
        completionStyleFrame = undefined
        refreshCompletedQuestionStyles()
      })
    }

    surveyModel.onAfterRenderQuestion.add((_, options) => {
      renderedQuestions.current.set(options.question.name, options.htmlElement)
      refreshCompletedQuestionStyles()
    })
    surveyModel.onValueChanged.add(scheduleCompletedQuestionStyleRefresh)

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

  useEffect(() => {
    const addActionMarkers = () => {
      document.querySelectorAll('.sd-question__title').forEach((questionTitle) => {
        const titleText = questionTitle.textContent ?? ''

        if (!titleText.match(/\[action\]/i) || questionTitle.querySelector('.survey-action-marker')) {
          return
        }

        const actionMarker = document.createElement('span')
        actionMarker.className = 'survey-action-marker'
        actionMarker.setAttribute('aria-hidden', 'true')
        actionMarker.textContent = '!'
        questionTitle.insertBefore(actionMarker, questionTitle.firstChild)
      })
    }

    addActionMarkers()

    const observer = new MutationObserver(() => {
      addActionMarkers()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [model])

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
      {pageIndex !== 0 && !showNoFiltersMessage && (
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
      {showNoFiltersMessage ? (
        <div
          className="govuk-error-summary"
          role="alert"
          aria-labelledby="no-filters-error-title"
        >
          <h2 className="govuk-error-summary__title" id="no-filters-error-title">
            There is a problem
          </h2>
          <div className="govuk-error-summary__body">
            <ul className="govuk-list govuk-error-summary__list">
              <li>
                <a
                  href="#project-detail"
                  onClick={(event) => {
                    event.preventDefault()
                    onNavigateToProjectDetail()
                  }}
                >
                  Select project filters to display questions.
                </a>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className={pageIndex === 0 ? 'survey-form survey-form--project-detail' : 'survey-form'}>
          <Survey model={model} />
        </div>
      )}
    </section>
  )
}