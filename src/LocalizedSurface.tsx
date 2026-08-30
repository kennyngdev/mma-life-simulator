import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from './i18n'
import { loadLegacyEnglishCatalog, localizeLegacyText } from './locales/legacy'

const translatedText = new WeakMap<Node, { source: string; translated: string }>()
const translatedAttributes = new WeakMap<Element, Map<string, { source: string; translated: string }>>()
const localizedAttributes = ['aria-label', 'aria-description', 'alt', 'placeholder', 'title']

function excluded(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
  return Boolean(element?.closest('[data-i18n-native], script, style'))
}

function translateNode(node: Node, english: boolean) {
  if (excluded(node)) return
  if (node.nodeType === Node.TEXT_NODE) {
    const current = node.textContent ?? ''
    const previous = translatedText.get(node)
    if (!english) {
      if (previous && current === previous.translated) node.textContent = previous.source
      translatedText.delete(node)
      return
    }
    const source = previous && current === previous.translated ? previous.source : current
    const translated = localizeLegacyText(source)
    if (translated === source) {
      translatedText.delete(node)
      return
    }
    translatedText.set(node, { source, translated })
    if (current !== translated) node.textContent = translated
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const element = node as Element
  let attributeState = translatedAttributes.get(element)
  if (!attributeState) {
    attributeState = new Map()
    translatedAttributes.set(element, attributeState)
  }
  for (const name of localizedAttributes) {
    const current = element.getAttribute(name)
    if (current === null) continue
    const previous = attributeState.get(name)
    if (!english) {
      if (previous && current === previous.translated) element.setAttribute(name, previous.source)
      attributeState.delete(name)
      continue
    }
    const source = previous && current === previous.translated ? previous.source : current
    const translated = localizeLegacyText(source)
    if (translated === source) {
      attributeState.delete(name)
      continue
    }
    attributeState.set(name, { source, translated })
    if (current !== translated) element.setAttribute(name, translated)
  }
  element.childNodes.forEach((child) => translateNode(child, english))
}

export function LocalizedSurface({ children }: { children: ReactNode }) {
  const { locale } = useI18n()
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = root.current
    if (!container) return
    const english = locale === 'en'
    let disposed = false
    let observer: MutationObserver | undefined
    const start = async () => {
      if (english) await loadLegacyEnglishCatalog()
      if (disposed) return
      translateNode(container, english)
      observer = new MutationObserver((mutations) => {
        observer?.disconnect()
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') translateNode(mutation.target, english)
          else if (mutation.type === 'characterData') translateNode(mutation.target, english)
          else mutation.addedNodes.forEach((node) => translateNode(node, english))
        }
        observer?.observe(container, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: localizedAttributes })
      })
      observer.observe(container, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: localizedAttributes })
    }
    void start()
    return () => { disposed = true; observer?.disconnect() }
  }, [locale])

  return <div ref={root} className="localized-app-root">{children}</div>
}
