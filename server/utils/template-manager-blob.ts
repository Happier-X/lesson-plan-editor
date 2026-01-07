import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { put, del, list, head } from '@vercel/blob'

export interface TemplateInfo {
  id: string
  name: string
  uploadDate: string
  placeholders: string[]
  blobUrl: string  // Blob 存储的 URL
}

export interface TemplateData {
  [key: string]: string | string[] | any
}

/**
 * Word模板管理器 - Vercel Blob 版本
 */
export class TemplateBlobManager {
  private readonly prefix = 'templates/'

  /**
   * 保存上传的模板到 Vercel Blob
   */
  async saveTemplate(buffer: Buffer, filename: string): Promise<TemplateInfo> {
    const id = Date.now().toString()
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_')

    // 提取占位符
    const placeholders = await this.extractPlaceholders(buffer)

    // 上传模板文件到 Blob
    const templateBlob = await put(
      `${this.prefix}${id}_${sanitizedFilename}`,
      buffer,
      {
        access: 'public',
        addRandomSuffix: false,
      }
    )

    // 创建模板信息
    const info: TemplateInfo = {
      id,
      name: sanitizedFilename,
      uploadDate: new Date().toISOString(),
      placeholders,
      blobUrl: templateBlob.url
    }

    // 保存模板信息到 Blob
    await put(
      `${this.prefix}${id}_info.json`,
      JSON.stringify(info),
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json'
      }
    )

    return info
  }

  /**
   * 从Word模板中提取占位符
   */
  async extractPlaceholders(buffer: Buffer): Promise<string[]> {
    try {
      const zip = new PizZip(buffer)

      // 直接读取document.xml内容
      const documentXml = zip.file('word/document.xml')?.asText()
      if (!documentXml) {
        return []
      }

      // 移除所有XML标签，只保留文本内容
      const textContent = documentXml.replace(/<[^>]+>/g, '')

      // 提取所有占位符 {字段名}
      const placeholderRegex = /\{([^{}]+)\}/g
      const placeholders = new Set<string>()

      let match
      while ((match = placeholderRegex.exec(textContent)) !== null) {
        const placeholder = match[1].trim()
        // 过滤掉空的或包含特殊字符的无效占位符
        if (placeholder && !/[<>]/.test(placeholder)) {
          placeholders.add(placeholder)
        }
      }

      return Array.from(placeholders)
    } catch (error) {
      console.error('提取占位符失败:', error)
      return []
    }
  }

  /**
   * 获取所有模板列表
   */
  async listTemplates(): Promise<TemplateInfo[]> {
    const { blobs } = await list({
      prefix: this.prefix,
    })

    const infoBlobs = blobs.filter(b => b.pathname.endsWith('_info.json'))

    const templates: TemplateInfo[] = []
    for (const blob of infoBlobs) {
      try {
        const response = await fetch(blob.url)
        const info = await response.json()
        templates.push(info)
      } catch (error) {
        console.error('读取模板信息失败:', blob.pathname, error)
      }
    }

    return templates.sort((a, b) =>
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    )
  }

  /**
   * 获取模板信息
   */
  async getTemplate(id: string): Promise<TemplateInfo | null> {
    try {
      const { blobs } = await list({
        prefix: `${this.prefix}${id}_info.json`,
      })

      if (blobs.length === 0) return null

      const response = await fetch(blobs[0].url)
      return await response.json()
    } catch (error) {
      console.error('获取模板信息失败:', error)
      return null
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: string): Promise<boolean> {
    try {
      const info = await this.getTemplate(id)
      if (!info) return false

      // 删除模板文件和信息文件
      await del([
        `${this.prefix}${id}_${info.name}`,
        `${this.prefix}${id}_info.json`
      ])

      return true
    } catch (error) {
      console.error('删除模板失败:', error)
      return false
    }
  }

  /**
   * 使用数据填充模板生成新的Word文档
   */
  async fillTemplate(id: string, data: TemplateData): Promise<Buffer> {
    const info = await this.getTemplate(id)
    if (!info) {
      throw new Error('模板不存在')
    }

    // 从 Blob 下载模板文件
    const response = await fetch(info.blobUrl)
    const arrayBuffer = await response.arrayBuffer()
    const templateBuffer = Buffer.from(arrayBuffer)

    try {
      const zip = new PizZip(templateBuffer)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '{',
          end: '}'
        },
        parser: (tag: string) => ({
          get: (scope: any) => {
            if (tag in data) {
              return data[tag]
            }
            return `{${tag}}`
          }
        })
      })

      // 填充数据
      doc.render(data)

      // 生成新的文档
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      })

      return buffer
    } catch (error: any) {
      console.error('填充模板失败:', error)

      if (error.properties && error.properties.errors) {
        const errors = error.properties.errors
        const errorMessages = errors.map((e: any) => e.message).join('; ')
        throw new Error(`填充模板失败: ${errorMessages}`)
      }

      throw new Error(`填充模板失败: ${error.message}`)
    }
  }
}

// 检查是否在 Vercel 环境中
const isVercel = process.env.VERCEL === '1' || process.env.BLOB_READ_WRITE_TOKEN

// 根据环境选择管理器
export const templateManager = isVercel
  ? new TemplateBlobManager()
  : (await import('./template-manager')).templateManager
