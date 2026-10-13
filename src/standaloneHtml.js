async function serializeRules(rules, baseUrl, assetCache) {
  const serializedRules = await Promise.all(Array.from(rules, async (rule) => {
    if (rule.type === CSSRule.IMPORT_RULE) {
      if (!rule.styleSheet) {
        throw new Error('A stylesheet import could not be loaded for the HTML export.')
      }

      const importedRules = await serializeStyleSheet(rule.styleSheet, assetCache)
      const media = rule.media?.mediaText
      return media && media !== 'all'
        ? `@media ${media}{${importedRules}}`
        : importedRules
    }

    if (rule.type === CSSRule.MEDIA_RULE) {
      const nestedRules = await serializeRules(rule.cssRules, baseUrl, assetCache)
      return `@media ${rule.conditionText}{${nestedRules}}`
    }

    if (rule.cssRules) {
      const openingBrace = rule.cssText.indexOf('{')
      if (openingBrace === -1) {
        return rule.cssText
      }
      return `${rule.cssText.slice(0, openingBrace + 1)}${await serializeRules(rule.cssRules, baseUrl, assetCache)}}`
    }

    return inlineCssAssets(rule.cssText, baseUrl, assetCache)
  }))
  return serializedRules.join('\n')
}

async function serializeStyleSheet(styleSheet, assetCache) {
  try {
    return await serializeRules(styleSheet.cssRules, styleSheet.href || document.baseURI, assetCache)
  } catch (error) {
    throw new Error(`Unable to read styles for the HTML export: ${error.message}`)
  }
}

async function inlineCssAssets(cssText, baseUrl, assetCache = new Map()) {
  const urls = [...new Set(
    [...cssText.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)]
      .map((match) => (match[1] ?? match[2] ?? match[3]).trim())
      .filter((url) => (
        url
        && !url.startsWith('data:')
        && !url.startsWith('#')
        && !url.startsWith('var(')
      )),
  )]

  const embeddedAssets = await Promise.all(urls.map(async (url) => {
    const absoluteUrl = new URL(url, baseUrl).href
    if (assetCache.has(absoluteUrl)) {
      return [url, await assetCache.get(absoluteUrl)]
    }

    const assetPromise = (async () => {
      const response = await fetch(absoluteUrl)
      if (!response.ok) {
        throw new Error(`Unable to load a stylesheet asset for the HTML export (${response.status}).`)
      }

      const blob = await response.blob()
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
      }

      const dataUrl = `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
      return dataUrl
    })()
    assetCache.set(absoluteUrl, assetPromise)
    return [url, await assetPromise]
  }))

  const assetMap = new Map(embeddedAssets)
  return cssText.replace(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g, (match, doubleQuoted, singleQuoted, unquoted) => {
    const url = (doubleQuoted ?? singleQuoted ?? unquoted).trim()
    const dataUrl = assetMap.get(url)
    return dataUrl ? `url("${dataUrl}")` : match
  })
}

function serializeComputedStyle(style) {
  return Array.from({ length: style.length }, (_, index) => {
    const property = style.item(index)
    return `${property}:${style.getPropertyValue(property)} !important;`
  }).join('')
}

async function inlineRenderedStyles(source, clone, assetCache) {
  const sourceElements = [source, ...source.querySelectorAll('*')]
  const cloneElements = [clone, ...clone.querySelectorAll('*')]
  const pseudoRules = []
  const styleTexts = sourceElements.map((element, index) => {
    const computedStyle = serializeComputedStyle(getComputedStyle(element))

    for (const pseudo of ['::before', '::after']) {
      const pseudoStyle = getComputedStyle(element, pseudo)
      const content = pseudoStyle.getPropertyValue('content')
      if (content && content !== 'none' && content !== 'normal') {
        cloneElements[index].setAttribute('data-html-export-node', String(index))
        pseudoRules.push(
          `[data-html-export-node="${index}"]${pseudo}{${serializeComputedStyle(pseudoStyle)}}`,
        )
      }
    }

    return computedStyle
  })

  await Promise.all(styleTexts.map(async (styleText, index) => {
    cloneElements[index].setAttribute(
      'style',
      await inlineCssAssets(styleText, document.baseURI, assetCache),
    )
  }))

  const cssText = await inlineCssAssets(pseudoRules.join('\n'), document.baseURI, assetCache)
  return cssText ? `<style>${cssText}</style>` : ''
}

function copyFormControlValues(source, clone) {
  const sourceControls = source.querySelectorAll('input, textarea, select')
  const cloneControls = clone.querySelectorAll('input, textarea, select')

  sourceControls.forEach((control, index) => {
    const clonedControl = cloneControls[index]
    if (control instanceof HTMLInputElement) {
      clonedControl.setAttribute('value', control.value)
      if (control.checked) {
        clonedControl.setAttribute('checked', '')
      } else {
        clonedControl.removeAttribute('checked')
      }
    } else if (control instanceof HTMLTextAreaElement) {
      clonedControl.textContent = control.value
    } else if (control instanceof HTMLSelectElement) {
      Array.from(control.options).forEach((option, optionIndex) => {
        const clonedOption = clonedControl.options[optionIndex]
        if (option.selected) {
          clonedOption.setAttribute('selected', '')
        } else {
          clonedOption.removeAttribute('selected')
        }
      })
    }
  })
}

export async function createStandaloneSectionHtml(section, title) {
  if (!section) {
    throw new Error('The active section could not be found for the HTML export.')
  }

  const clone = section.cloneNode(true)
  copyFormControlValues(section, clone)
  const assetCache = new Map()
  const renderedStyles = await inlineRenderedStyles(section, clone, assetCache)

  const stylesheets = await Promise.all(Array.from(document.styleSheets)
    .filter((styleSheet) => !styleSheet.disabled)
    .map((styleSheet) => serializeStyleSheet(styleSheet, assetCache)))
  const cssText = await inlineCssAssets(stylesheets.join('\n'), document.baseURI, assetCache)
  const safeTitle = title.replace(/[&<>"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[character])

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>${cssText}</style>
${renderedStyles}
</head>
<body class="govuk-template__body app-shell">
${clone.outerHTML}
</body>
</html>`
}
