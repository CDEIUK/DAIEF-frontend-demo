import { useState } from 'react'
import SurveyPage from './SurveyPage.jsx'
import ProjectInfo from './ProjectInfo.jsx'
import HowToUse from './HowToUse.jsx'
import './App.css'
import 'govuk-frontend/dist/govuk/govuk-frontend.min.css'
import surveyJson from '../translated-survey.json'

const stages = [
  { id: 'discovery', label: 'Discovery', pageIndex: 0 },
  { id: 'alpha', label: 'Alpha', pageIndex: 1 },
  { id: 'beta', label: 'Beta', pageIndex: 2 },
  { id: 'live', label: 'Live', pageIndex: 3 },
]

const navigationStart = [
  { id: 'how-to-use', label: 'How to use', component: HowToUse },
  { id: 'project-info', label: 'Project detail', component: ProjectInfo },
]

const navigationEnd = []

const navigationItems = [...navigationStart, ...stages, ...navigationEnd]

function App() {
  const [activePageId, setActivePageId] = useState('discovery')
  const [stageData, setStageData] = useState({})
  const [surveyVersion, setSurveyVersion] = useState(0)

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

  function handleFileDownload() {
    const responseFile = new Blob([
      JSON.stringify({ stageData }, null, 2),
    ], { type: 'application/json' })
    const downloadUrl = URL.createObjectURL(responseFile)
    const downloadLink = document.createElement('a')

    downloadLink.href = downloadUrl
    downloadLink.download = 'daief-survey-responses.json'
    downloadLink.click()
    URL.revokeObjectURL(downloadUrl)
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
              </svg> Data and AI Ethics Framework: Interactive Guidance
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
            <h1 className="govuk-heading-xl">Interactive Guidance [Demo]</h1>
            <section className="save-panel" aria-labelledby="save-panel-heading">
              <p id="save-panel-heading" className="govuk-body">[Save and return instructions]</p>
            </section>
              <div className="save-panel__actions">
                <div>
                  <label className="govuk-button save-panel__button" htmlFor="response-file-upload">
                    Upload JSON File
                  </label>
                  <input
                    id="response-file-upload"
                    className="save-panel__input"
                    type="file"
                    accept="application/json,.json"
                    onChange={handleFileUpload}
                  />
                </div>
                <button type="button" className="govuk-button save-panel__button" onClick={handleFileDownload}>
                  Download JSON File
                </button>
              </div>
            <div class="govuk-!-margin-bottom-5">
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
                key={`${activePageId}-${surveyVersion}`}
                surveyJson={surveyJson}
                initialData={stageData[activePageId]}
                onDataChange={handleDataChange}
                pageIndex={currentStage.pageIndex}
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
