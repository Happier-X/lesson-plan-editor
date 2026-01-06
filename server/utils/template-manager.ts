import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { promises as fs } from 'fs'
import path from 'path'

export interface TemplateInfo {
  id: string
  name: string
  uploadDate: string
  placeholders: string[]
}

export interface TemplateData {
  [key: string]: string | string[] | any
}

/**
 * Word模板管理器
 */
export class TemplateManager {
  private templateDir: string

  constructor() {
    // 模板存储目录
    this.templateDir = path.join(process.cwd(), '.templates')
  }

  /**
   * 初始化模板目录
   */
  async ensureTemplateDir() {
    try {
      await fs.access(this.templateDir)
    } catch {
      await fs.mkdir(this.templateDir, { recursive: true })
    }
  }

  /**
   * 保存上传的模板
   */
  async saveTemplate(buffer: Buffer, filename: string): Promise<TemplateInfo> {
    await this.ensureTemplateDir()

    const id = Date.now().toString()
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_')
    const templatePath = path.join(this.templateDir, `${id}_${sanitizedFilename}`)

    // 保存模板文件
    await fs.writeFile(templatePath, buffer)

    // 提取占位符
    const placeholders = await this.extractPlaceholders(buffer)

    // 保存模板信息
    const info: TemplateInfo = {
      id,
      name: sanitizedFilename,
      uploadDate: new Date().toISOString(),
      placeholders
    }

    const infoPath = path.join(this.templateDir, `${id}_info.json`)
    await fs.writeFile(infoPath, JSON.stringify(info, null, 2))

    return info
  }

  /**
   * 从Word模板中提取占位符
   * 直接从XML中提取，避免docxtemplater的解析错误
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
    await this.ensureTemplateDir()

    const files = await fs.readdir(this.templateDir)
    const infoFiles = files.filter(f => f.endsWith('_info.json'))

    const templates: TemplateInfo[] = []
    for (const infoFile of infoFiles) {
      const infoPath = path.join(this.templateDir, infoFile)
      const content = await fs.readFile(infoPath, 'utf-8')
      templates.push(JSON.parse(content))
    }

    return templates.sort((a, b) =>
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    )
  }

  /**
   * 获取模板信息
   */
  async getTemplate(id: string): Promise<TemplateInfo | null> {
    const infoPath = path.join(this.templateDir, `${id}_info.json`)
    try {
      const content = await fs.readFile(infoPath, 'utf-8')
      return JSON.parse(content)
    } catch {
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

      const templatePath = path.join(this.templateDir, `${id}_${info.name}`)
      const infoPath = path.join(this.templateDir, `${id}_info.json`)

      await fs.unlink(templatePath)
      await fs.unlink(infoPath)

      return true
    } catch {
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

    const templatePath = path.join(this.templateDir, `${id}_${info.name}`)
    const templateBuffer = await fs.readFile(templatePath)

    try {
      const zip = new PizZip(templateBuffer)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        // 使用单花括号作为分隔符
        delimiters: {
          start: '{',
          end: '}'
        },
        // 不进行严格的标签检查，允许分散的标签
        parser: (tag: string) => ({
          get: (scope: any) => {
            // 如果数据中有这个键，返回对应的值
            if (tag in data) {
              return data[tag]
            }
            // 否则返回原始标签，避免错误
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

      // 如果是多个错误，提取详细信息
      if (error.properties && error.properties.errors) {
        const errors = error.properties.errors
        const errorMessages = errors.map((e: any) => e.message).join('; ')
        throw new Error(`填充模板失败: ${errorMessages}`)
      }

      throw new Error(`填充模板失败: ${error.message}`)
    }
  }
}

// 导出单例
export const templateManager = new TemplateManager()