import { useState } from 'react'
import SurveyPage from './SurveyPage.jsx'
import HowToUse from './HowToUse.jsx'
import './App.css'
import 'govuk-frontend/dist/govuk/govuk-frontend.min.css'
import surveyJson from '../translated-survey.json'

const stages = [
  { id: 'project-detail', label: 'Project detail', pageIndex: 0 },
  { id: 'discovery', label: 'Discovery', pageIndex: 1 },
  { id: 'alpha', label: 'Alpha', pageIndex: 2 },
  { id: 'beta', label: 'Beta', pageIndex: 3 },
  { id: 'live', label: 'Live', pageIndex: 4 },
]

const navigationStart = [
  { id: 'how-to-use', label: 'How to use', component: HowToUse },
]

const navigationEnd = []

const navigationItems = [...navigationStart, ...stages, ...navigationEnd]

function App() {
  const [activePageId, setActivePageId] = useState('project-detail')
  const [stageData, setStageData] = useState({})
  const [surveyVersion, setSurveyVersion] = useState(0)
  const [hideCommentQuestions, setHideCommentQuestions] = useState(false)
  const [filenameDialogOpen, setFilenameDialogOpen] = useState(false)
  const [filenameInput, setFilenameInput] = useState('')

  const currentStage = stages.find((stage) => stage.id === activePageId)
  const currentPage = navigationItems.find((item) => item.id === activePageId)
  const Page = currentPage?.component

  function handlePageChange(pageId) {
    setActivePageId(pageId)
    window.location.hash = pageId
  }

  function handleDataChange(data) {
    setStageData((currentData) => ({
      ...currentData,
      [activePageId]: { ...data },
    }))
  }

  async function handleFileUpload(event) {
    const [file] = event.target.files
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const importedData = JSON.parse(await file.text())
      const responseData = importedData.stageData ?? importedData

      if (!responseData || typeof responseData !== 'object' || Array.isArray(responseData)) {
        throw new Error('The uploaded file must contain survey responses.')
      }

      setStageData(responseData)
      setSurveyVersion((version) => version + 1)
    } catch (error) {
      window.alert(error instanceof SyntaxError ? 'The uploaded file is not valid JSON.' : error.message)
    }
  }

  function getDefaultFileName() {
    const projectName = String(stageData['project-detail']?.['1'] ?? '').trim() || 'Project'
    const today = new Date()
    const currentDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    return `DAIEF Interactive Guidance - ${projectName} ${currentDate}.json`
  }

  function handleSaveProgress() {
    setFilenameInput(getDefaultFileName())
    setFilenameDialogOpen(true)
  }

  function handleFileDownload(event) {
    event.preventDefault()
    const safeFileName = [...filenameInput]
      .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
      .join('')
      .trim()
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/[. ]+$/, '') || getDefaultFileName()
    const downloadFileName = safeFileName.toLowerCase().endsWith('.json')
      ? safeFileName
      : `${safeFileName}.json`
    const responseFile = new Blob([
      JSON.stringify({ stageData }, null, 2),
    ], { type: 'application/json' })
    const downloadUrl = URL.createObjectURL(responseFile)
    const downloadLink = document.createElement('a')

    downloadLink.href = downloadUrl
    downloadLink.download = downloadFileName
    downloadLink.click()
    URL.revokeObjectURL(downloadUrl)
    setFilenameDialogOpen(false)
  }

  function handlePrintCurrentSection() {
    if (!currentStage) {
      return
    }

    window.print()
  }

  return (
    <div className="govuk-template__body app-shell">
      <div class="govuk-generic-header">
        <div class="govuk-generic-header__container govuk-width-container">
          <div class="govuk-generic-header__logo">
            <a href="#" class="govuk-generic-header__homepage-link">
              <svg width="28" height="30" viewBox="0 0 28 30" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <circle cx="13.5549" cy="4.21349" r="4.21349" />
                <circle cx="13.5549" cy="25.7865" r="4.21349" />
                <circle cx="22.8963" cy="9.6068" r="4.21349" />
                <circle cx="4.2135" cy="20.3932" r="4.21349" />
                <circle cx="22.8963" cy="20.3932" r="4.21349" />
                <circle cx="4.21351" cy="9.60674" r="4.21349" />
              </svg> Data and AI Ethics Framework
            </a>
          </div>
        </div>
        </div>
      <div class="govuk-phase-banner govuk-width-container">
        <p class="govuk-phase-banner__content">
          <strong class="govuk-tag govuk-phase-banner__content__tag">
            Demo
          </strong>
          <span class="govuk-phase-banner__text">
            This site is for demostration purposes only. It uses the GOV.UK Design System, but is not an official government service.
          </span>
        </p>
      </div> 
      <main className="govuk-main-wrapper govuk-width-container" id="main-content">
        <div className="govuk-grid-row">
          <div className="govuk-grid-column-full">
            <p className="govuk-caption-xl">Data and AI Ethics Framework</p>
            <h1 className="govuk-heading-xl">Interactive Guidance</h1>
            <section className="save-panel" aria-labelledby="save-panel-heading">
              <p id="save-panel-heading" className="govuk-body">Information that you enter on this site is stored locally on your computer and isn't shared with the UK government. Use the Restore and Save buttons to upload and download your form as a JSON file between sessions. You can print your answers as a formatted page for the active section using the Print button.</p>
            </section>
              <div className="save-panel__actions">
                <div className="save-panel__file-actions">
                  <div>
                    <label className="govuk-button save-panel__button" htmlFor="response-file-upload">
                      Restore progress
                    </label>
                    <input
                      id="response-file-upload"
                      className="save-panel__input"
                      type="file"
                      accept="application/json,.json"
                      onChange={handleFileUpload}
                    />
                  </div>
                  <button type="button" className="govuk-button save-panel__button" onClick={handleSaveProgress}>
                    Save progress
                  </button>
                  <button
                    type="button"
                    className="govuk-button save-panel__button"
                    onClick={handlePrintCurrentSection}
                    disabled={!currentStage}
                  >
                    Print active section
                  </button>
                </div>
                <div className="govuk-checkboxes govuk-checkboxes--small comment-visibility-toggle">
                  <div className="govuk-checkboxes__item">
                    <input
                      className="govuk-checkboxes__input"
                      id="hide-comment-questions"
                      name="hide-comment-questions"
                      type="checkbox"
                      checked={hideCommentQuestions}
                      onChange={(event) => setHideCommentQuestions(event.target.checked)}
                    />
                    <label className="govuk-label govuk-checkboxes__label" htmlFor="hide-comment-questions">
                      Workbook questions off
                    </label>
                  </div>
                </div>
              </div>
            {filenameDialogOpen && (
              <div className="filename-dialog-backdrop">
                <section
                  className="filename-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="filename-dialog-title"
                >
                  <h2 id="filename-dialog-title" className="govuk-heading-m">Save progress</h2>
                  <form onSubmit={handleFileDownload}>
                    <label className="govuk-label" htmlFor="progress-filename">File name</label>
                    <input
                      autoFocus
                      className="govuk-input"
                      id="progress-filename"
                      name="progress-filename"
                      value={filenameInput}
                      onChange={(event) => setFilenameInput(event.target.value)}
                    />
                    <div className="filename-dialog__actions">
                      <button type="submit" className="govuk-button">Download JSON</button>
                      <button
                        type="button"
                        className="govuk-button govuk-button--secondary"
                        onClick={() => setFilenameDialogOpen(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
            <div class="govuk-!-margin-bottom-8">
            </div>
            <div className="govuk-service-navigation"
              data-module="govuk-service-navigation">
              <div className="govuk-width-container">
                <div className="govuk-service-navigation__container">
                  <nav aria-label="Survey stages" className="govuk-service-navigation__wrapper">
                    <button type="button" className="govuk-service-navigation__toggle govuk-js-service-navigation-toggle" aria-controls="navigation" hidden aria-hidden="true">
                      Menu
                    </button>
                    <ul className="govuk-service-navigation__list" id="navigation">
                      {navigationItems.map((item) => {
                        const isActive = item.id === activePageId

                        return (
                          <li className={`govuk-service-navigation__item${isActive ? ' govuk-service-navigation__item--active' : ''}`} key={item.id}>
                            <a
                              className="govuk-service-navigation__link"
                              href={`#${item.id}`}
                              aria-label={item.id === 'how-to-use' ? item.label : undefined}
                              title={item.id === 'how-to-use' ? item.label : undefined}
                              aria-current={isActive ? 'page' : undefined}
                              onClick={(event) => {
                                event.preventDefault()
                                handlePageChange(item.id)
                              }}
                            >
                              {item.id === 'how-to-use' && <span className="app-navigation__info-icon" aria-hidden="true">i</span>}
                              {item.id !== 'how-to-use' && (isActive ? <strong className="govuk-service-navigation__active-fallback">{item.label}</strong> : item.label)}
                            </a>
                          </li>
                        )
                      })}
                    </ul>
                  </nav>
                </div>
              </div>
            </div>
            <div class="govuk-!-margin-bottom-5">
            </div>
            {currentStage ? (
              <SurveyPage
                key={`${activePageId}-${surveyVersion}-${hideCommentQuestions}`}
                surveyJson={surveyJson}
                initialData={stageData[activePageId]}
                onDataChange={handleDataChange}
                pageIndex={currentStage.pageIndex}
                hideCommentQuestions={hideCommentQuestions}
                projectName={stageData['project-detail']?.['1']}
              />
            ) : Page ? <Page /> : null}
          </div>
        </div>
      </main>
      
      <footer className="govuk-footer">
        <div className="govuk-width-container">
          <div className="govuk-footer__meta">
            <span className="govuk-footer__licence-description">Demo</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
