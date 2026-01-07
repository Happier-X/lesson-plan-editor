import { TemplateBlobManager } from './template-manager-blob'
import { templateManager as localTemplateManager } from './template-manager'
import type { TemplateInfo, TemplateData } from './template-manager'

// 根据环境自动选择合适的模板管理器
const isVercel = process.env.VERCEL === '1' || !!process.env.BLOB_READ_WRITE_TOKEN

if (isVercel) {
  console.log('使用 Vercel Blob 存储')
} else {
  console.log('使用本地文件系统存储')
}

export const templateManager = isVercel ? new TemplateBlobManager() : localTemplateManager

// 重新导出类型
export type { TemplateInfo, TemplateData }
