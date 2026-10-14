import { useEffect, useRef } from 'react'
import { Accordion } from 'govuk-frontend'

const initializedAccordions = new WeakSet()

export default function HowToUse({ onNavigateToFirstSection }) {
  const accordionRef = useRef(null)

  useEffect(() => {
    const accordionElement = accordionRef.current

    if (!accordionElement || initializedAccordions.has(accordionElement)) {
      return
    }

    new Accordion(accordionElement)
    initializedAccordions.add(accordionElement)
  }, [])

  return (
    <div className="govuk-grid-row">
      <div className="govuk-grid-column-full">
        <h2 className="govuk-heading-l">About</h2>
        <p className="govuk-body">The Interactive Guidance is for people who work in government and other public sector organisations. It is aimed at individuals or teams working with data, data-driven systems, algorithmic systems or AI as part of delivering a project or service.</p>
        <p className="govuk-body">This online tool is designed to help you to apply the <a href="https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework" target="_blank" rel="noreferrer">Data and AI Ethics Framework</a> to your own project. It guides you through a series of questions that encourage you to think practically about the following ethical principles:</p>
        <ul className="govuk-list govuk-list--bullet govuk-!-padding-left-7">
          <li><a href="https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework#transparency-section" target="_blank" rel="noreferrer">Transparency</a></li>
          <li><a href="https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework#accountability-section" target="_blank" rel="noreferrer">Accountability</a></li>
          <li><a href="https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework#fairness-section" target="_blank" rel="noreferrer">Fairness</a></li>
          <li><a href="https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework#privacy-section" target="_blank" rel="noreferrer">Privacy</a></li>
          <li><a href="https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework#environmental-sustainability-section" target="_blank" rel="noreferrer">Environmental sustainability</a></li>
          <li><a href="https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework#societal-impact-section" target="_blank" rel="noreferrer">Societal impact</a></li>
          <li><a href="https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework#safety-section" target="_blank" rel="noreferrer">Safety</a></li>
        </ul>
        <p className="govuk-body">Using this tool, you can identify ethical risks across the project life cycle and document the ways in which you are addressing data and AI ethics challenges within your project.</p>

        <a
          href="#project-detail"
          role="button"
          draggable="false"
          className="govuk-button govuk-button--start"
          data-module="govuk-button"
          onClick={(event) => {
            event.preventDefault()
            onNavigateToFirstSection()
          }}
        >
          Start using the tool
          <svg className="govuk-button__start-icon" xmlns="http://www.w3.org/2000/svg" width="17.5" height="19" viewBox="0 0 33 40" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M0 0h13l20 20-20 20H0l20-20z" />
          </svg>
        </a>
        
        <p className="govuk-body">Expand the dropdowns below to learn more.</p>

        <div ref={accordionRef} className="govuk-accordion" data-module="govuk-accordion" id="accordion-default">
          <div className="govuk-accordion__section">
            <div className="govuk-accordion__section-header">
              <h2 className="govuk-accordion__section-heading">
                <span className="govuk-accordion__section-button" id="accordion-default-heading-1">
                  How the tool works
                </span>
              </h2>
            </div>
            <div id="accordion-default-content-1" className="govuk-accordion__section-content">
              <p className="govuk-body">The Interactive Guidance is an intelligent form split into five sections:</p>
              <ul className="govuk-list govuk-list--bullet govuk-!-padding-left-7">
                <li><a>The Project Detail section allows you to enter key information about your project and control the questions that you see using filters.</a></li>
                <li><a>The Discovery, Alpha, Beta and Live sections ask you questions about your ethical delivery approach at four different stages of the project life cycle.</a></li>
              </ul>
              <p className="govuk-body">Each form section contains several question sets to work through. Question sets are composed of three elements:</p>
              <ul className="govuk-list govuk-list--bullet govuk-!-padding-left-7">
                <li><a>Radio questions (white): single choice questions that trigger further questions, fields and actions.</a></li>
                <li><a>Workbook fields (blue): text boxes for documenting key ethical information about your project.</a></li>
                <li><a>Actions (red): advice and suggestions for you to follow up on where applicable.</a></li>
              </ul>
              <p className="govuk-body">A question set will be marked as complete and turn green when all radio questions have been answered and there are no outstanding actions. The grey progress panels display how many sets have been started, how many sets are complete and how many actions remain within the section.</p>
              <p className="govuk-body">The form is intended to offer helpful guidance and prompt you to reflect on how your project is meeting ethical best practice. It is not intended to provide assurance or sign-off for a project.</p>
              </div>
          </div>
          <div className="govuk-accordion__section">
            <div className="govuk-accordion__section-header">
              <h2 className="govuk-accordion__section-heading">
                <span className="govuk-accordion__section-button" id="accordion-default-heading-2">
                  When to use the tool
                </span>
              </h2>
            </div>
            <div id="accordion-default-content-2" className="govuk-accordion__section-content">
              <p className="govuk-body">You can enter information into individual sections at different phases of your project over its entire duration. Refer to the section descriptions for more information about the Discovery, Alpha, Beta and Live project phases.</p>
              <p className="govuk-body">The tool is designed to be used iteratively. You can return to the form at any time to update your answers and add new information as your project progresses. You may wish to revisit the form after responding to suggested actions.</p>
              <p className="govuk-body">Throughout, we suggest that you retain the completed sections locally for future reference or to make available to colleagues working on the project.</p>
            </div>
          </div>
          <div className="govuk-accordion__section">
            <div className="govuk-accordion__section-header">
              <h2 className="govuk-accordion__section-heading">
                <span className="govuk-accordion__section-button" id="accordion-default-heading-3">
                  How to use the tool
                </span>
              </h2>
            </div>
            <div id="accordion-default-content-3" className="govuk-accordion__section-content">
              <p className="govuk-body">The tool can be used for both documenting and guiding your project. You can switch between these two modes using the "Hide workbook fields" checkbox.</p>
              <p className="govuk-body"> Workbook fields can be used to produce a written artefact for sharing and to use in governance, assurance and project management processes. They can be hidden if you want to work through question sets quicker. You can always return to workbook fields after completing questions without them.</p>
              <p className="govuk-body">Form sections can be exported as formatted documents at any time using the export button. You have the option to save as an HTML page (recommended) or a PDF.</p>
            </div>
          </div>
          <div className="govuk-accordion__section">
            <div className="govuk-accordion__section-header">
              <h2 className="govuk-accordion__section-heading">
                <span className="govuk-accordion__section-button" id="accordion-default-heading-4">
                  How information is stored and saved
                </span>
              </h2>
            </div>
            <div id="accordion-default-content-4" className="govuk-accordion__section-content">
              <p className="govuk-body">Information that you enter into the form is stored temporarily in your browser’s session memory. Data will remain intact when switching between form sections. However, data will be lost when you refresh the page, close the website or your browser session ends.</p>
              <p className="govuk-body">You may save your form data locally to your computer as a JSON file. These data can be uploaded back to the site in a new session for you to continue the form where you left off.</p>
              <p className="govuk-body">Your data is not currently stored in any permanent database and is not processed by any other party.</p>
            </div>
          </div>
          <div className="govuk-accordion__section">
            <div className="govuk-accordion__section-header">
              <h2 className="govuk-accordion__section-heading">
                <span className="govuk-accordion__section-button" id="accordion-default-heading-4">
                  Contact and feedback
                </span>
              </h2>
            </div>
            <div id="accordion-default-content-4" className="govuk-accordion__section-content">
              <p className="govuk-body">The tool is designed and maintained by the Responsible AI and Data Team in GDS.</p>
              <p className="govuk-body">If you have feedback on the tool… [feedback option]</p>
              <p className="govuk-body">If you require more direct support from the Responsible AI and Data Team, please email us at 
          <a href="mailto:GDS-Responsible-Data-AI@dsit.gov.uk" className="govuk-link" target="_blank" rel="noreferrer"> GDS-Responsible-Data-AI@dsit.gov.uk</a>.</p>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
