import { useRef, useState } from 'react'
import SurveyPage from './SurveyPage.jsx'
import HowToUse from './HowToUse.jsx'
import './App.css'
import 'govuk-frontend/dist/govuk/govuk-frontend.min.css'
import surveyJson from '../translated-survey.json'
import { createStandaloneSectionHtml } from './standaloneHtml.js'

const surveyDefinitionKey = JSON.stringify(surveyJson)

const stages = [
  { id: 'project-detail', label: 'Project Detail', pageIndex: 0 },
  { id: 'discovery', label: 'Discovery', pageIndex: 1 },
  { id: 'alpha', label: 'Alpha', pageIndex: 2 },
  { id: 'beta', label: 'Beta', pageIndex: 3 },
  { id: 'live', label: 'Live', pageIndex: 4 },
]

const navigationStart = [
  { id: 'about', label: 'How to use', component: HowToUse },
]

const navigationEnd = []

const navigationItems = [...navigationStart, ...stages, ...navigationEnd]
const projectDetailQuestionNames = new Set(
  surveyJson.pages[0].elements.map((question) => question.name),
)

function App() {
  const [activePageId, setActivePageId] = useState('about')
  const [stageData, setStageData] = useState({})
  const [surveyVersion, setSurveyVersion] = useState(0)
  const [hideCommentQuestions, setHideCommentQuestions] = useState(false)
  const [filenameDialogOpen, setFilenameDialogOpen] = useState(false)
  const [printFormatDialogOpen, setPrintFormatDialogOpen] = useState(false)
  const [filenameInput, setFilenameInput] = useState('')
  const printableSurveyRef = useRef(null)

  const currentStage = stages.find((stage) => stage.id === activePageId)
  const currentStageIndex = stages.findIndex((stage) => stage.id === activePageId)
  const previousStage = stages[currentStageIndex - 1]
  const nextStage = stages[currentStageIndex + 1]
  const currentPage = navigationItems.find((item) => item.id === activePageId)
  const Page = currentPage?.component

  function handlePageChange(pageId) {
    setActivePageId(pageId)
    window.location.hash = pageId
  }

  function handleDataChange(data) {
    const pageData = activePageId === 'project-detail'
      ? data
      : Object.fromEntries(
        Object.entries(data).filter(([name]) => !projectDetailQuestionNames.has(name)),
      )

    setStageData((currentData) => ({
      ...currentData,
      [activePageId]: pageData,
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
    const projectName = String(stageData['project-detail']?.NAME ?? '').trim() || 'Project'
    const today = new Date()
    const currentDate = [
      String(today.getDate()).padStart(2, '0'),
      String(today.getMonth() + 1).padStart(2, '0'),
      today.getFullYear(),
    ].join('-')
    return `${projectName} ${currentDate}.json`
  }

  function handleSaveProgress() {
    setFilenameInput(getDefaultFileName())
    setFilenameDialogOpen(true)
  }

  async function handleFileDownload(event) {
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

    if (window.showSaveFilePicker) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: downloadFileName,
          types: [{
            description: 'JSON file',
            accept: { 'application/json': ['.json'] },
          }],
        })
        const writable = await fileHandle.createWritable()
        await writable.write(responseFile)
        await writable.close()
        setFilenameDialogOpen(false)
      } catch (error) {
        if (error.name !== 'AbortError') {
          window.alert(`Unable to save the progress file: ${error.message}`)
        }
      }
      return
    }

    const downloadUrl = URL.createObjectURL(responseFile)
    const downloadLink = document.createElement('a')

    downloadLink.href = downloadUrl
    downloadLink.download = downloadFileName
    downloadLink.click()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    setFilenameDialogOpen(false)
  }

  function handlePrintCurrentSection() {
    if (!currentStage) {
      return
    }

    setPrintFormatDialogOpen(false)
    window.print()
  }

  async function handleSaveActiveSectionHtml() {
    if (!currentStage) {
      return
    }

    const projectName = String(stageData['project-detail']?.NAME ?? '').trim() || 'Project'
    const today = new Date()
    const date = [
      String(today.getDate()).padStart(2, '0'),
      String(today.getMonth() + 1).padStart(2, '0'),
      today.getFullYear(),
    ].join('-')
    const fileName = `${projectName} - ${currentStage.label} ${date}`
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/[. ]+$/, '') + '.html'

    let saveFilePickerPromise
    try {
      if (window.showSaveFilePicker) {
        saveFilePickerPromise = window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'HTML file',
            accept: { 'text/html': ['.html'] },
          }],
        })
      }

      setPrintFormatDialogOpen(false)
      const fileHandle = saveFilePickerPromise
        ? await saveFilePickerPromise
        : null
      const html = await createStandaloneSectionHtml(
        printableSurveyRef.current,
        `${currentStage.label} - ${projectName}`,
      )
      const htmlFile = new Blob([html], { type: 'text/html;charset=utf-8' })

      if (fileHandle) {
        const writable = await fileHandle.createWritable()
        await writable.write(htmlFile)
        await writable.close()
        return
      }

      const downloadUrl = URL.createObjectURL(htmlFile)
      const downloadLink = document.createElement('a')
      downloadLink.href = downloadUrl
      downloadLink.download = fileName
      downloadLink.click()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    } catch (error) {
      if (error.name !== 'AbortError') {
        window.alert(`Unable to save the active section as HTML: ${error.message}`)
      }
    }
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
            Private Beta
          </strong>
          <span class="govuk-phase-banner__text">
            This is a new application – your <a class="govuk-link" href="mailto: GDS-Responsible-Data-AI@dsit.gov.uk" target="_blank" rel="noopener noreferrer">feedback</a> will help us to improve it.
          </span>
        </p>
      </div> 
      <main className="govuk-main-wrapper govuk-width-container" id="main-content">
        <div className="govuk-grid-row">
          <div className="govuk-grid-column-full">
            <p className="govuk-caption-xl">Data and AI Ethics Framework</p>
            <h1 className="govuk-heading-xl">Self-Assessment Tool</h1>
            <section className="save-panel" aria-labelledby="save-panel-heading">
              <p id="save-panel-heading" className="govuk-body">Information that you enter on this site is stored locally on your computer and isn't shared with the UK government. Use the Restore and Save buttons to upload and download your form as a JSON file between sessions. Print or save the active section as PDF or HTML using the print button.</p>
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
                    onClick={() => setPrintFormatDialogOpen(true)}
                    disabled={!currentStage}
                  >
                    Export active section
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
                      Hide document fields
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
            {printFormatDialogOpen && (
              <div className="filename-dialog-backdrop">
                <section
                  className="filename-dialog print-format-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="print-format-dialog-title"
                >
                  <h2 id="print-format-dialog-title" className="govuk-heading-m">Choose a format</h2>
                  <p className="govuk-body">Choose how to export the active section.</p>
                  <div className="filename-dialog__actions">
                    <button type="button" className="govuk-button" onClick={handleSaveActiveSectionHtml}>
                      Save as HTML
                    </button>
                    <button type="button" className="govuk-button" onClick={handlePrintCurrentSection}>
                      Print as PDF
                    </button>
                    <button
                      type="button"
                      className="govuk-button govuk-button--secondary"
                      onClick={() => setPrintFormatDialogOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
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
                              aria-label={item.id === 'about' ? item.label : undefined}
                              title={item.id === 'about' ? item.label : undefined}
                              aria-current={isActive ? 'page' : undefined}
                              onClick={(event) => {
                                event.preventDefault()
                                handlePageChange(item.id)
                              }}
                            >
                              {item.id === 'about' && <span className="app-navigation__info-icon" aria-hidden="true">i</span>}
                              {item.id !== 'about' && (isActive ? <strong className="govuk-service-navigation__active-fallback">{item.label}</strong> : item.label)}
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
              <>
                <SurveyPage
                  key={`${activePageId}-${surveyVersion}-${hideCommentQuestions}-${surveyDefinitionKey}`}
                  surveyJson={surveyJson}
                  initialData={stageData[activePageId]}
                  sharedData={activePageId === 'project-detail' ? undefined : stageData['project-detail']}
                  onDataChange={handleDataChange}
                  onNavigateToProjectDetail={() => handlePageChange('project-detail')}
                  pageIndex={currentStage.pageIndex}
                  hideCommentQuestions={hideCommentQuestions}
                  projectName={stageData['project-detail']?.NAME}
                  printableSurveyRef={printableSurveyRef}
                />
                <nav className="app-section-navigation" aria-label="Form section navigation">
                  {previousStage && (
                    <button
                      type="button"
                      className="govuk-button govuk-button--secondary"
                      onClick={() => handlePageChange(previousStage.id)}
                    >
                      Previous: {previousStage.label}
                    </button>
                  )}
                  {nextStage && (
                    <button
                      type="button"
                      className="govuk-button govuk-button--secondary app-section-navigation__next"
                      onClick={() => handlePageChange(nextStage.id)}
                    >
                      Next: {nextStage.label}
                    </button>
                  )}
                </nav>
              </>
            ) : Page ? (
              <Page onNavigateToFirstSection={() => handlePageChange('project-detail')} />
            ) : null}
          </div>
        </div>

      </main>

      <div className="govuk-feedback">
        <div className="govuk-width-container">
          <div className="govuk-grid-row">
            <div className="govuk-grid-column-full">
              <h2 className="govuk-feedback__title">
                Help us improve
              </h2>
              <div className="govuk-feedback__body">
                <p className="govuk-body">
                  Tell us about your experience using this website. <a href="#" className="govuk-link">Give us your feedback</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="govuk-footer">
        <div class="govuk-width-container">
          <div class="govuk-footer__meta">
            <div class="govuk-footer__meta-item govuk-footer__meta-item--grow">
              <svg
                aria-hidden="true"
                focusable="false"
                class="govuk-footer__licence-logo"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 483.2 195.7"
                height="17"
                width="41">
                <path
                  fill="currentColor"
                  d="M421.5 142.8V.1l-50.7 32.3v161.1h112.4v-50.7zm-122.3-9.6A47.12 47.12 0 0 1 221 97.8c0-26 21.1-47.1 47.1-47.1 16.7 0 31.4 8.7 39.7 21.8l42.7-27.2A97.63 97.63 0 0 0 268.1 0c-36.5 0-68.3 20.1-85.1 49.7A98 98 0 0 0 97.8 0C43.9 0 0 43.9 0 97.8s43.9 97.8 97.8 97.8c36.5 0 68.3-20.1 85.1-49.7a97.76 97.76 0 0 0 149.6 25.4l19.4 22.2h3v-87.8h-80l24.3 27.5zM97.8 145c-26 0-47.1-21.1-47.1-47.1s21.1-47.1 47.1-47.1 47.2 21 47.2 47S123.8 145 97.8 145" />
              </svg>
              <span class="govuk-footer__licence-description">
                All content is available under the <a
                  class="govuk-footer__link"
                  href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                  rel="license">Open Government Licence v3.0</a>, except where otherwise stated
              </span>
            </div>
            <div class="govuk-footer__meta-item">
              <a
                class="govuk-footer__link govuk-footer__copyright-logo"
                href="https://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/crown-copyright/">
                © Crown copyright
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
