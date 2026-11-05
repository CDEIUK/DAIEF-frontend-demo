import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'
import { useEffect, useRef, useState } from 'react'

import 'survey-core/survey-core.css'

function hasTriggeredAction(model, pageIndex, series, actionQuestionNames) {
  return (model.pages[pageIndex]?.elements ?? []).some((question) => (
    question.name?.match(new RegExp(`^${series}(?:$|[a-z])`))
    && (actionQuestionNames.has(question.name) || question.name.endsWith('S'))
    && question.isVisible
  ))
}

function showCompletionError(completionControl, checkbox, message) {
  completionControl.classList.add('govuk-form-group--error')
  let completionError = completionControl.querySelector('.survey-completion-error')
  if (!completionError) {
    completionError = document.createElement('p')
    completionError.className = 'govuk-error-message survey-completion-error'
    completionError.id = `${checkbox.id}-error`
    const errorPrefix = document.createElement('span')
    errorPrefix.className = 'govuk-visually-hidden'
    errorPrefix.textContent = 'Error:'
    const errorText = document.createElement('span')
    errorText.className = 'survey-completion-error__text'
    completionError.append(errorPrefix, document.createTextNode(' '), errorText)
    completionControl.append(completionError)
  }
  completionError.querySelector('.survey-completion-error__text').textContent = message
  checkbox.setAttribute('aria-describedby', completionError.id)
}

function clearCompletionError(completionControl, checkbox) {
  completionControl.classList.remove('govuk-form-group--error')
  completionControl.querySelector('.survey-completion-error')?.remove()
  checkbox.removeAttribute('aria-describedby')
}

function getStartedSeries(model, questions, rootQuestionNames) {
  const startedSeries = new Set()

  questions.forEach((question) => {
    const series = question.name?.match(/^\d+/)?.[0]
    if (!series || question.name.endsWith('S')) {
      return
    }

    const value = model.getValue(question.name)
    const isRootTextQuestion = (
      rootQuestionNames.has(question.name) || /^\d+$/.test(question.name)
    )
      && ['comment', 'text'].includes(question.getType())
    const hasInput = isRootTextQuestion
      ? typeof value === 'string' && value.trim() !== ''
      : value !== undefined && value !== null && value !== ''
    if (hasInput) {
      startedSeries.add(series)
    }
  })

  return startedSeries
}

function getProgressSummary(
  model,
  pageIndex,
  manuallyCompletedSeries = new Set(),
  rootQuestionNames = new Set(),
  actionQuestionNames = new Set(),
) {
  const page = model.pages[pageIndex]
  const questions = page?.elements ?? []
  const startedSeries = getStartedSeries(model, questions, rootQuestionNames)
  const rootSeries = new Set(
    [...rootQuestionNames]
      .map((name) => name.match(/^\d+/)?.[0])
      .filter(Boolean),
  )
  const allSeries = new Set()
  const filteredOutSeries = new Set()
  let actionCount = 0

  questions.forEach((question) => {
    const seriesMatch = question.name?.match(/^\d+/)

    if (
      seriesMatch
      && rootSeries.has(seriesMatch[0])
      && question.getType() === 'radiogroup'
      && !question.isVisible
    ) {
      filteredOutSeries.add(seriesMatch[0])
    }

    if (!seriesMatch) {
      return
    }

    if (question.isVisible) {
      allSeries.add(seriesMatch[0])
    }

    if (question.name.endsWith('S') || actionQuestionNames.has(question.name)) {
      if (question.isVisible) {
        actionCount += 1
      }
      return
    }
  })

  return {
    startedCount: startedSeries.size,
    actionCount,
    completedCount: [...manuallyCompletedSeries].filter((series) => allSeries.has(series)).length,
    totalSeriesCount: allSeries.size,
    filteredOutSeriesCount: filteredOutSeries.size,
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

export default function SurveyPage({ surveyJson, initialData, sharedData, onDataChange, onNavigateToProjectDetail, printableSurveyRef, pageIndex = 0, projectName = '' }) {
  const pageTitle = surveyJson.pages[pageIndex]?.title ?? ''
  const pageDescription = surveyJson.pages[pageIndex]?.description ?? ''
  const pageElements = surveyJson.pages[pageIndex]?.elements ?? []
  const hasExplicitRoots = pageElements.some((question) => question.isRoot)
  const rootQuestionNames = new Set(
    pageElements
      .filter((question) => (
        question.isRoot || (!hasExplicitRoots && /^\d+$/.test(question.name))
      ))
      .map((question) => question.name),
  )
  const actionQuestionNames = new Set(
    pageElements
      .filter((question) => question.type === 'expression' && !question.isContext)
      .map((question) => question.name),
  )
  const questionSetHeadersBySeries = new Map(
    pageElements
      .filter((question) => rootQuestionNames.has(question.name) && question.questionSetHeader?.trim())
      .map((question) => [question.name.match(/^\d+/)?.[0], question.questionSetHeader.trim()]),
  )
  const themeLabelsBySeries = new Map()
  pageElements.forEach((question) => {
    const series = question.name.match(/^\d+/)?.[0]
    if (!series || !question.themes?.length) {
      return
    }

    const themes = themeLabelsBySeries.get(series) ?? []
    question.themes.forEach((theme) => {
      if (!themes.includes(theme)) {
        themes.push(theme)
      }
    })
    themeLabelsBySeries.set(series, themes)
  })
  const contextQuestionNames = new Set(
    (surveyJson.pages[pageIndex]?.elements ?? [])
      .filter((question) => question.isContext)
      .map((question) => question.name),
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
  const renderedQuestionSetHeaders = useRef(new Map())
  const renderedQuestionSetCompletionControls = useRef(new Map())
  const manuallyCompletedSeries = useRef(new Set())
  const collapsedSeries = useRef(new Set(
    [...rootQuestionNames]
      .map((name) => name.match(/^\d+/)?.[0])
      .filter(Boolean),
  ))
  const [model] = useState(() => {
    const surveyModel = new Model(surveyJson)
    surveyModel.widthMode = 'responsive'
    surveyModel.onTextMarkdown.add((_, options) => {
      if (/\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)/.test(options.text)) {
        options.html = renderMarkdownLinks(options.text)
      }
    })
    surveyModel.data = { ...initialData, ...sharedData }
    surveyModel.currentPageNo = pageIndex

    const refreshQuestionSetHeaderStyles = () => {
      const questions = surveyModel.pages[pageIndex]?.elements ?? []
      const startedSeries = getStartedSeries(surveyModel, questions, rootQuestionNames)

      renderedQuestionSetHeaders.current.forEach((header, series) => {
        const hasAction = hasTriggeredAction(
          surveyModel,
          pageIndex,
          series,
          actionQuestionNames,
        )
        const isCompleted = manuallyCompletedSeries.current.has(series)
        header.classList.toggle('survey-question-set-header--action', hasAction)
        header.classList.toggle('survey-question-set-header--completed', !hasAction && isCompleted)
        header.classList.toggle(
          'survey-question-set-header--started',
          !hasAction && !isCompleted && startedSeries.has(series),
        )
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
        let completionChanged = false
        manuallyCompletedSeries.current.forEach((series) => {
          if (!hasTriggeredAction(surveyModel, pageIndex, series, actionQuestionNames)) {
            return
          }

          manuallyCompletedSeries.current.delete(series)
          completionChanged = true
          const checkbox = document.getElementById(`mark-complete-${pageIndex}-${series}`)
          const completionControl = renderedQuestionSetCompletionControls.current.get(series)
          if (checkbox instanceof HTMLInputElement) {
            checkbox.checked = false
            if (completionControl) {
              clearCompletionError(completionControl, checkbox)
            }
          }
        })
        if (completionChanged) {
          setProgressSummary(getProgressSummary(
            surveyModel,
            pageIndex,
            manuallyCompletedSeries.current,
            rootQuestionNames,
            actionQuestionNames,
          ))
        }
        refreshQuestionSetHeaderStyles()
        refreshFilterErrorState()
      })
    }

    surveyModel.onAfterRenderQuestion.add((_, options) => {
      renderedQuestions.current.set(options.question.name, options.htmlElement)
      if (contextQuestionNames.has(options.question.name)) {
        options.htmlElement.classList.add('survey-context')
      }
      if (pageIndex === 0) {
        options.htmlElement.classList.add('survey-project-detail-question')
      }
      refreshFilterErrorState()
      const questionSeries = options.question.name.match(/^\d+/)?.[0]
      const isQuestionSetRoot = rootQuestionNames.has(options.question.name)
      const series = isQuestionSetRoot ? questionSeries : undefined
      const themes = themeLabelsBySeries.get(questionSeries)
      if (questionSeries) {
        options.htmlElement.hidden = collapsedSeries.current.has(questionSeries)
      }
      if (series && options.htmlElement.parentElement) {
        let setHeader = options.htmlElement.previousElementSibling
        if (!setHeader?.classList.contains('survey-question-set-header')) {
          setHeader = document.createElement('div')
          setHeader.className = 'survey-question-set-header'
          setHeader.dataset.series = series
          renderedQuestionSetHeaders.current.set(series, setHeader)

          const headingRow = document.createElement('div')
          headingRow.className = 'survey-question-set-header__row'
          const headingContent = document.createElement('div')
          headingContent.className = 'survey-question-set-header__content'
          const heading = document.createElement('h3')
          heading.className = 'govuk-heading-m survey-question-set-header__heading'
          const questionSetHeader = questionSetHeadersBySeries.get(series)
          const headingButton = document.createElement('button')
          headingButton.className = 'survey-question-set-header__toggle'
          headingButton.type = 'button'
          headingButton.setAttribute(
            'aria-expanded',
            String(!collapsedSeries.current.has(series)),
          )
          const headingText = document.createElement('span')
          headingText.textContent = questionSetHeader
            ? `${series}. ${questionSetHeader}`
            : 'Question set heading'
          const headingIcon = document.createElement('span')
          headingIcon.className = 'survey-question-set-header__toggle-icon'
          headingIcon.setAttribute('aria-hidden', 'true')
          headingButton.append(headingText, headingIcon)
          headingButton.addEventListener('click', () => {
            const isExpanded = collapsedSeries.current.has(series)
            if (isExpanded) {
              collapsedSeries.current.delete(series)
            } else {
              collapsedSeries.current.add(series)
            }
            headingButton.setAttribute('aria-expanded', String(isExpanded))
            renderedQuestions.current.forEach((element, name) => {
              if (name.match(/^\d+/)?.[0] === series) {
                element.hidden = !isExpanded
              }
            })
            const completionContainer = renderedQuestionSetCompletionControls.current.get(series)
              ?.closest('.survey-question-set-completion')
            if (completionContainer) {
              completionContainer.hidden = !isExpanded
            }
          })
          heading.append(headingButton)
          headingContent.append(heading)
          setHeader.append(headingRow)
          headingRow.append(headingContent)

          if (themes?.length) {
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
            headingContent.append(themeList)
          }

          const checkboxGroup = document.createElement('div')
          checkboxGroup.className = 'govuk-checkboxes govuk-checkboxes--small'
          const checkboxItem = document.createElement('div')
          checkboxItem.className = 'govuk-checkboxes__item'
          const completionControl = document.createElement('div')
          completionControl.className = 'survey-completion-control'
          const completionContainer = document.createElement('div')
          completionContainer.className = 'survey-question-set-completion'
          completionContainer.hidden = collapsedSeries.current.has(series)
          const checkbox = document.createElement('input')
          checkbox.className = 'govuk-checkboxes__input'
          checkbox.type = 'checkbox'
          checkbox.id = `mark-complete-${pageIndex}-${series}`
          checkbox.checked = manuallyCompletedSeries.current.has(series)
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              const errorMessage = hasTriggeredAction(
                surveyModel,
                pageIndex,
                series,
                actionQuestionNames,
              )
                ? 'Resolve the action before marking this question set as complete.'
                : !getStartedSeries(
                  surveyModel,
                  surveyModel.pages[pageIndex]?.elements ?? [],
                  rootQuestionNames,
                ).has(series)
                  ? 'Start the question set before marking it as complete.'
                  : undefined

              if (errorMessage) {
                checkbox.checked = false
                manuallyCompletedSeries.current.delete(series)
                showCompletionError(completionControl, checkbox, errorMessage)
              } else {
                manuallyCompletedSeries.current.add(series)
                clearCompletionError(completionControl, checkbox)
              }
            } else {
              manuallyCompletedSeries.current.delete(series)
              clearCompletionError(completionControl, checkbox)
            }
            refreshQuestionSetHeaderStyles()
            setProgressSummary(getProgressSummary(
              surveyModel,
              pageIndex,
              manuallyCompletedSeries.current,
              rootQuestionNames,
              actionQuestionNames,
            ))
          })
          const checkboxLabel = document.createElement('label')
          checkboxLabel.className = 'govuk-label govuk-checkboxes__label'
          checkboxLabel.htmlFor = checkbox.id
          checkboxLabel.textContent = 'Mark set as complete'
          checkboxItem.append(checkbox, checkboxLabel)
          checkboxGroup.append(checkboxItem)
          completionControl.append(checkboxGroup)
          completionContainer.append(completionControl)
          setHeader.append(completionContainer)
          renderedQuestionSetCompletionControls.current.set(series, completionControl)
          options.htmlElement.parentElement.insertBefore(setHeader, options.htmlElement)
        }
      }
      refreshQuestionSetHeaderStyles()
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
      refreshQuestionSetHeaderStyles()
    })
    surveyModel.onValueChanged.add(scheduleCompletedQuestionStyleRefresh)

    return surveyModel
  })
  const [progressSummary, setProgressSummary] = useState(() => (
    getProgressSummary(
      model,
      pageIndex,
      manuallyCompletedSeries.current,
      rootQuestionNames,
      actionQuestionNames,
    )
  ))

  useEffect(() => {
    const handleValueChanged = () => {
      setProgressSummary(getProgressSummary(
        model,
        pageIndex,
        manuallyCompletedSeries.current,
        rootQuestionNames,
        actionQuestionNames,
      ))
      onDataChange(model.data)
    }
    model.onValueChanged.add(handleValueChanged)

    return () => model.onValueChanged.remove(handleValueChanged)
  }, [model, onDataChange, pageIndex])

  useEffect(() => {
    const handleDocumentClick = (event) => {
      const surveyElement = printableSurveyRef.current
      const target = event.target
      if (!surveyElement || !(target instanceof Element)) {
        return
      }

      surveyElement.querySelectorAll('.survey-completion-control.govuk-form-group--error').forEach((completionControl) => {
        if (completionControl.contains(target)) {
          return
        }

        const checkbox = completionControl.querySelector('.govuk-checkboxes__input')
        if (checkbox instanceof HTMLInputElement) {
          clearCompletionError(completionControl, checkbox)
        }
      })
    }

    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [printableSurveyRef])

  useEffect(() => {
    const addActionMarkers = () => {
      document.querySelectorAll('.survey-document-marker').forEach((marker) => {
        const label = marker.nextElementSibling
        if (label?.classList.contains('survey-document-label')) {
          let nextElement = label.nextElementSibling
          label.remove()
          for (let index = 0; index < 2 && nextElement?.tagName === 'BR'; index += 1) {
            const followingElement = nextElement.nextElementSibling
            nextElement.remove()
            nextElement = followingElement
          }
        }
        marker.remove()
      })

      document.querySelectorAll('.sd-question:has(.sd-expression):not(.survey-context) .sd-question__title').forEach((questionTitle) => {
        addTitleMarker(
          questionTitle,
          'survey-action-marker',
          '!',
          'survey-action-label',
          'Action',
        )
      })

      document.querySelectorAll('.sd-question.survey-context .sd-question__title').forEach((questionTitle) => {
        addTitleMarker(
          questionTitle,
          'survey-context-marker',
          'i',
          'survey-context-label',
          'Info',
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