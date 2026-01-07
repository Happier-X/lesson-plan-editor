import { TemplateBlobManager } from './template-manager-blob'
import type { TemplateInfo, TemplateData } from './template-manager'

/**
 * 根据环境自动选择合适的模板管理器
 * - Vercel 环境: 使用 Blob 存储
 * - 本地环境: 使用文件系统
 */
export function getTemplateManager() {
  const isVercel = process.env.VERCEL === '1' || !!process.env.BLOB_READ_WRITE_TOKEN

  if (isVercel) {
    console.log('使用 Vercel Blob 存储')
    return new TemplateBlobManager()
  } else {
    console.log('使用本地文件系统存储')
    // 动态导入避免循环依赖
    const { templateManager: localManager } = require('./template-manager')
    return localManager
  }
}

export const templateManager = getTemplateManager()

// 重新导出类型
export type { TemplateInfo, TemplateData }
