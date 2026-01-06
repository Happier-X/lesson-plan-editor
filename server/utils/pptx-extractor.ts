import AdmZip from 'adm-zip'
import { parseString } from 'xml2js'
import { promisify } from 'util'

const parseXml = promisify(parseString)

export interface SlideContent {
  slideNumber: number
  texts: string[]  // 所有文本内容，按顺序保留
  notes?: string
  rawTexts?: string[]  // 原始文本（未去重）
  images?: string[]  // 图片base64数组
}

export interface PptxContent {
  slides: SlideContent[]
  totalSlides: number
  metadata?: {
    title?: string
    author?: string
    subject?: string
  }
}

/**
 * 从PPTX文件中提取文本内容和图片
 */
export async function extractPptxContent(buffer: Buffer): Promise<PptxContent> {
  const zip = new AdmZip(buffer)
  const zipEntries = zip.getEntries()

  const slides: SlideContent[] = []
  const slideFiles = zipEntries.filter(entry =>
    entry.entryName.match(/ppt\/slides\/slide\d+\.xml/)
  ).sort((a, b) => {
    const numA = parseInt(a.entryName.match(/\d+/)?.[0] || '0')
    const numB = parseInt(b.entryName.match(/\d+/)?.[0] || '0')
    return numA - numB
  })

  // 提取每张幻灯片的内容
  for (let i = 0; i < slideFiles.length; i++) {
    const slideEntry = slideFiles[i]
    const slideXml = slideEntry.getData().toString('utf8')
    const slideNumber = slideEntry.entryName.match(/\d+/)?.[0] || (i + 1).toString()

    const slideContent = await extractSlideContent(slideXml, i + 1)

    // 提取图片
    const images = await extractSlideImages(zip, slideNumber, slideXml)
    if (images.length > 0) {
      slideContent.images = images
    }

    // 尝试提取备注
    const notesEntry = zipEntries.find(entry =>
      entry.entryName === `ppt/notesSlides/notesSlide${slideNumber}.xml`
    )

    if (notesEntry) {
      const notesXml = notesEntry.getData().toString('utf8')
      slideContent.notes = await extractNotesContent(notesXml)
    }

    slides.push(slideContent)
  }

  // 提取元数据
  const metadata = await extractMetadata(zip)

  return {
    slides,
    totalSlides: slides.length,
    metadata
  }
}

/**
 * 从幻灯片XML中提取内容（按照文本框顺序提取）
 */
async function extractSlideContent(xml: string, slideNumber: number): Promise<SlideContent> {
  const result: any = await parseXml(xml)
  const allTexts: string[] = []
  const textByShape: string[][] = []

  // 提取p:sld -> p:cSld -> p:spTree中的所有形状
  const slide = result['p:sld']
  if (!slide) return { slideNumber, texts: [] }

  const cSld = slide['p:cSld']?.[0]
  if (!cSld) return { slideNumber, texts: [] }

  const spTree = cSld['p:spTree']?.[0]
  if (!spTree) return { slideNumber, texts: [] }

  // 遍历所有形状（p:sp）
  const shapes = spTree['p:sp'] || []

  for (const shape of shapes) {
    const txBody = shape['p:txBody']?.[0]
    if (!txBody) continue

    const shapeTexts: string[] = []
    const paragraphs = txBody['a:p'] || []

    // 遍历每个段落
    for (const paragraph of paragraphs) {
      const runs = paragraph['a:r'] || []
      const paragraphTexts: string[] = []

      // 遍历每个文本run
      for (const run of runs) {
        const textNode = run['a:t']?.[0]
        if (textNode && typeof textNode === 'string') {
          paragraphTexts.push(textNode)
        }
      }

      // 如果段落有文本，加入到形状文本中
      if (paragraphTexts.length > 0) {
        const paragraphText = paragraphTexts.join('')
        if (paragraphText.trim()) {
          shapeTexts.push(paragraphText.trim())
        }
      }
    }

    // 将形状的所有文本添加到总列表
    if (shapeTexts.length > 0) {
      textByShape.push(shapeTexts)
      allTexts.push(...shapeTexts)
    }
  }

  return {
    slideNumber,
    texts: allTexts,
    rawTexts: allTexts  // 保留原始文本顺序
  }
}

/**
 * 提取备注内容
 */
async function extractNotesContent(xml: string): Promise<string> {
  const result: any = await parseXml(xml)
  const textElements: string[] = []

  function extractText(obj: any) {
    if (!obj) return

    if (typeof obj === 'string') {
      textElements.push(obj.trim())
      return
    }

    if (Array.isArray(obj)) {
      obj.forEach(item => extractText(item))
      return
    }

    if (typeof obj === 'object') {
      if (obj['a:t']) {
        const text = Array.isArray(obj['a:t']) ? obj['a:t'].join('') : obj['a:t']
        if (text && typeof text === 'string' && text.trim()) {
          textElements.push(text.trim())
        }
      }
      Object.values(obj).forEach(value => extractText(value))
    }
  }

  extractText(result)
  return [...new Set(textElements)].filter(t => t.length > 0).join(' ')
}

/**
 * 提取元数据
 */
async function extractMetadata(zip: AdmZip): Promise<PptxContent['metadata']> {
  const corePropsEntry = zip.getEntry('docProps/core.xml')
  if (!corePropsEntry) return {}

  const corePropsXml = corePropsEntry.getData().toString('utf8')

  try {
    const result: any = await parseXml(corePropsXml)
    const props = result['cp:coreProperties'] || {}

    return {
      title: props['dc:title']?.[0] || undefined,
      author: props['dc:creator']?.[0] || undefined,
      subject: props['dc:subject']?.[0] || undefined,
    }
  } catch {
    return {}
  }
}

/**
 * 提取幻灯片中的图片
 */
async function extractSlideImages(zip: AdmZip, slideNumber: string, slideXml: string): Promise<string[]> {
  try {
    const result: any = await parseXml(slideXml)
    const images: string[] = []

    // 获取关系文件
    const relsEntry = zip.getEntry(`ppt/slides/_rels/slide${slideNumber}.xml.rels`)
    if (!relsEntry) return images

    const relsXml = relsEntry.getData().toString('utf8')
    const relsResult: any = await parseXml(relsXml)

    const relationships = relsResult['Relationships']?.['Relationship'] || []
    const imageRels: Map<string, string> = new Map()

    // 建立ID到图片路径的映射
    for (const rel of relationships) {
      const relId = rel['$']?.['Id']
      const target = rel['$']?.['Target']
      const type = rel['$']?.['Type']

      if (type && type.includes('image') && relId && target) {
        // 图片路径通常是相对路径，如 ../media/image1.png
        const imagePath = target.startsWith('../')
          ? `ppt/${target.substring(3)}`
          : `ppt/slides/${target}`

        imageRels.set(relId, imagePath)
      }
    }

    // 从幻灯片XML中查找图片引用
    const slide = result['p:sld']
    if (!slide) return images

    // 递归查找所有blip元素（图片引用）
    function findBlips(obj: any, imageIds: Set<string>) {
      if (!obj) return

      if (Array.isArray(obj)) {
        obj.forEach(item => findBlips(item, imageIds))
        return
      }

      if (typeof obj === 'object') {
        // 查找a:blip元素
        if (obj['a:blip']) {
          const blips = Array.isArray(obj['a:blip']) ? obj['a:blip'] : [obj['a:blip']]
          blips.forEach((blip: any) => {
            const embedId = blip['$']?.['r:embed']
            if (embedId) {
              imageIds.add(embedId)
            }
          })
        }

        // 递归搜索
        Object.values(obj).forEach(value => findBlips(value, imageIds))
      }
    }

    const imageIds = new Set<string>()
    findBlips(slide, imageIds)

    // 提取图片并转换为base64
    for (const imageId of imageIds) {
      const imagePath = imageRels.get(imageId)
      if (!imagePath) continue

      const imageEntry = zip.getEntry(imagePath)
      if (!imageEntry) continue

      const imageBuffer = imageEntry.getData()
      const ext = imagePath.split('.').pop()?.toLowerCase() || 'png'

      // 确定MIME类型
      let mimeType = 'image/png'
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
      else if (ext === 'gif') mimeType = 'image/gif'
      else if (ext === 'svg') mimeType = 'image/svg+xml'
      else if (ext === 'webp') mimeType = 'image/webp'

      const base64 = imageBuffer.toString('base64')
      images.push(`data:${mimeType};base64,${base64}`)
    }

    return images
  } catch (error) {
    console.error('提取图片失败:', error)
    return []
  }
}