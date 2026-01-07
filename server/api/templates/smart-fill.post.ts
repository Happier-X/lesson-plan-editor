import { matchPptToTemplateFields } from '../../utils/openai-helper'
import { templateManager } from '../../utils/get-template-manager'
import type { PptxContent } from '../../utils/pptx-extractor'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { templateId, pptContent } = body as {
      templateId: string
      pptContent: PptxContent
    }

    if (!templateId) {
      throw createError({
        statusCode: 400,
        message: '模板ID不能为空'
      })
    }

    if (!pptContent || !pptContent.slides || pptContent.slides.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'PPT内容不能为空'
      })
    }

    // 获取模板信息
    const templateInfo = await templateManager.getTemplate(templateId)
    if (!templateInfo) {
      throw createError({
        statusCode: 404,
        message: '模板不存在'
      })
    }

    // 检查是否有占位符
    if (templateInfo.placeholders.length === 0) {
      throw createError({
        statusCode: 400,
        message: '模板没有可填充的字段'
      })
    }

    // 使用AI智能匹配
    const filledData = await matchPptToTemplateFields(
      pptContent,
      templateInfo.placeholders
    )

    return {
      success: true,
      data: filledData
    }
  } catch (error: any) {
    console.error('智能填充失败:', error)

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '智能填充失败'
    })
  }
})
