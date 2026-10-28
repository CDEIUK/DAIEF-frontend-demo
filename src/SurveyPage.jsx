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
  let filteredOutSeriesCount = 0

  questions.forEach((question) => {
    const seriesMatch = question.name?.match(/^\d+/)

    if (/^\d+$/.test(question.name) && question.getType() === 'radiogroup' && !question.isVisible) {
      filteredOutSeriesCount += 1
    }

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
    filteredOutSeriesCount,
  }
}

function renderMarkdownLinks(text) {
  const output = document.createElement('div')
  const linkPattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g
  let lastIndex = 0
  let match

  while ((match = linkPattern.exec(text)) !== null) {
    output.append(document.createTextNode(text.slice(lastIndex, match.index)))

    let url
    try {
      url = new URL(match[2])
    } catch {
      output.append(document.createTextNode(match[0]))
      lastIndex = linkPattern.lastIndex
      continue
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      output.append(document.createTextNode(match[0]))
      lastIndex = linkPattern.lastIndex
      continue
    }

    const link = document.createElement('a')
    link.href = url.href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = match[1]
    output.append(link)
    lastIndex = linkPattern.lastIndex
  }

  output.append(document.createTextNode(text.slice(lastIndex)))
  return output.innerHTML
}

function addTitleMarker(questionTitle, markerClass, markerText, labelClass, labelText) {
  if (questionTitle.querySelector(`.${markerClass}`)) {
    return
  }

  const marker = document.createElement('span')
  marker.className = markerClass
  marker.setAttribute('aria-hidden', 'true')
  marker.textContent = markerText
  questionTitle.insertBefore(marker, questionTitle.firstChild)

  const label = document.createElement('span')
  label.className = labelClass
  label.textContent = ` ${labelText}`
  questionTitle.insertBefore(label, marker.nextSibling)

  const firstBreak = document.createElement('br')
  const secondBreak = document.createElement('br')
  questionTitle.insertBefore(firstBreak, label.nextSibling)
  questionTitle.insertBefore(secondBreak, firstBreak.nextSibling)
}

export default function SurveyPage({ surveyJson, initialData, sharedData, onDataChange, onNavigateToProjectDetail, printableSurveyRef, pageIndex = 0, hideCommentQuestions = false, projectName = '' }) {
  const pageTitle = surveyJson.pages[pageIndex]?.title ?? ''
  const pageDescription = surveyJson.pages[pageIndex]?.description ?? ''
  const themeLabelsByQuestion = new Map(
    (surveyJson.pages[pageIndex]?.elements ?? [])
      .filter((question) => /^\d+$/.test(question.name) && question.themes?.length)
      .map((question) => [question.name, question.themes]),
  )
  const hasSelectedFilters = Array.isArray(sharedData?.FILTER) && sharedData.FILTER.length > 0
  const showNoFiltersMessage = pageIndex !== 0 && !hasSelectedFilters
  const today = new Date()
  const currentDate = [
    String(today.getDate()).padStart(2, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    today.getFullYear(),
  ].join('-')
  const renderedQuestions = useRef(new Map())
  const seriesDividers = useRef(new Map())
  const [model] = useState(() => {
    const surveyModel = new Model(surveyJson)
    surveyModel.onTextMarkdown.add((_, options) => {
      if (/\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)/.test(options.text)) {
        options.html = renderMarkdownLinks(options.text)
      }
    })
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

    const refreshSeriesDividers = () => {
      if (pageIndex === 0) {
        return
      }

      const rootRadioQuestions = (surveyModel.pages[pageIndex]?.elements ?? [])
        .filter((question) => /^\d+$/.test(question.name) && question.getType() === 'radiogroup')
      let hasSeenVisibleSeries = false

      rootRadioQuestions.forEach((question) => {
        const isVisible = question.isVisible
        const showDivider = isVisible && hasSeenVisibleSeries
        if (isVisible) {
          hasSeenVisibleSeries = true
        }

        const element = renderedQuestions.current.get(question.name)
        if (!element) {
          return
        }

        const row = element.closest('.sd-row') ?? element
        const parent = row.parentElement
        if (!parent) {
          return
        }

        let divider = seriesDividers.current.get(question.name)
        if (!divider) {
          divider = document.createElement('div')
          divider.className = 'survey-series-divider'
          divider.setAttribute('aria-hidden', 'true')
          seriesDividers.current.set(question.name, divider)
        }

        divider.hidden = !showDivider
        parent.insertBefore(divider, row)
      })
    }

    const refreshFilterErrorState = () => {
      if (pageIndex !== 0) {
        return
      }

      const filterElement = renderedQuestions.current.get('FILTER')
      if (!filterElement) {
        return
      }

      const selectedFilters = surveyModel.getValue('FILTER')
      const hasSelectedFilters = Array.isArray(selectedFilters) && selectedFilters.length > 0
      filterElement.classList.toggle('survey-filter-question--error', !hasSelectedFilters)
      filterElement.classList.toggle('govuk-form-group--error', !hasSelectedFilters)

      let errorMessage = filterElement.querySelector('.survey-filter-error-message')
      if (!errorMessage) {
        errorMessage = document.createElement('span')
        errorMessage.className = 'govuk-error-message survey-filter-error-message'
        errorMessage.setAttribute('aria-live', 'polite')
        errorMessage.textContent = 'Select at least one filter.'
        filterElement.insertBefore(errorMessage, filterElement.firstChild)
      }

      errorMessage.hidden = hasSelectedFilters
    }

    let completionStyleFrame
    const scheduleCompletedQuestionStyleRefresh = () => {
      if (completionStyleFrame !== undefined) {
        window.cancelAnimationFrame(completionStyleFrame)
      }
      completionStyleFrame = window.requestAnimationFrame(() => {
        completionStyleFrame = undefined
        refreshCompletedQuestionStyles()
        refreshSeriesDividers()
        refreshFilterErrorState()
      })
    }

    surveyModel.onAfterRenderQuestion.add((_, options) => {
      renderedQuestions.current.set(options.question.name, options.htmlElement)
      if (pageIndex === 0) {
        options.htmlElement.classList.add('survey-project-detail-question')
      }
      refreshFilterErrorState()
      const themes = themeLabelsByQuestion.get(options.question.name)
      const questionTitle = options.htmlElement.querySelector('.sd-question__title')
      if (themes && questionTitle?.parentElement && !options.htmlElement.querySelector('.survey-theme-tags')) {
        const themeList = document.createElement('ul')
        themeList.className = 'survey-theme-tags'
        themeList.setAttribute('aria-label', 'Themes')
        themes.forEach((theme) => {
          const listItem = document.createElement('li')
          const tag = document.createElement('strong')
          tag.className = 'govuk-tag govuk-tag--blue'
          tag.textContent = theme
          listItem.append(tag)
          themeList.append(listItem)
        })
        questionTitle.parentElement.insertBefore(themeList, questionTitle)
      }
      if (options.question.getType() === 'radiogroup') {
        options.htmlElement.addEventListener('keydown', (event) => {
          const target = event.target
          if (
            (event.key === ' ' || event.code === 'Space')
            && target instanceof HTMLInputElement
            && target.type === 'radio'
            && target.checked
            && surveyModel.getValue(options.question.name) === target.value
          ) {
            event.preventDefault()
            surveyModel.clearValue(options.question.name)
          }
        })
        options.htmlElement.addEventListener('click', (event) => {
          const target = event.target
          if (
            target instanceof HTMLInputElement
            && target.type === 'radio'
            && target.checked
            && surveyModel.getValue(options.question.name) === target.value
          ) {
            event.preventDefault()
            surveyModel.clearValue(options.question.name)
          }
        }, true)
      }
      refreshCompletedQuestionStyles()
      refreshSeriesDividers()
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
      document.querySelectorAll('.sd-question:has(.sd-expression) .sd-question__title').forEach((questionTitle) => {
        addTitleMarker(
          questionTitle,
          'survey-action-marker',
          '!',
          'survey-action-label',
          'Action',
        )
      })

      document.querySelectorAll('.sd-question:has(.sd-comment):not(.survey-project-detail-question) .sd-question__title').forEach((questionTitle) => {
        addTitleMarker(
          questionTitle,
          'survey-document-marker',
          '🗎',
          'survey-document-label',
          'Document',
        )
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
    <section ref={printableSurveyRef} className="printable-survey">
      <div className="survey-metadata" aria-label="Form details">
        <span>Project name: {projectName?.trim() || '[None]'}</span>
        <span>Date: {currentDate}</span>
        <span>Form version: {surveyJson.formVersion ?? 'v0.3'}</span>
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
            <strong className="govuk-tag govuk-tag--grey">Filtered</strong>
            <span className="survey-progress-count">{progressSummary.filteredOutSeriesCount}</span>
          </div>
          <div className="survey-progress-item">
            <strong className="govuk-tag govuk-tag--yellow">Started</strong>
            <span className="survey-progress-count">{progressSummary.startedCount}/{progressSummary.totalSeriesCount}</span>
          </div>
          <div className="survey-progress-item">
            <strong className="govuk-tag govuk-tag--green">Completed</strong>
            <span className="survey-progress-count">{progressSummary.completedCount}/{progressSummary.totalSeriesCount}</span>
          </div>
          <div className="survey-progress-item">
            <strong className="govuk-tag govuk-tag--red">Action count</strong>
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