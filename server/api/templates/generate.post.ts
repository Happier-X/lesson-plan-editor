import { templateManager, type TemplateData } from '../../utils/get-template-manager'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { templateId, data } = body as { templateId: string; data: TemplateData }

    if (!templateId) {
      throw createError({
        statusCode: 400,
        message: '模板ID不能为空'
      })
    }

    if (!data) {
      throw createError({
        statusCode: 400,
        message: '填充数据不能为空'
      })
    }

    // 填充模板生成Word文档
    const buffer = await templateManager.fillTemplate(templateId, data)

    // 获取模板信息用于生成文件名
    const templateInfo = await templateManager.getTemplate(templateId)
    const filename = templateInfo
      ? `${templateInfo.name.replace('.docx', '')}_${Date.now()}.docx`
      : `generated_${Date.now()}.docx`

    // 设置响应头
    setResponseHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length.toString()
    })

    return buffer
  } catch (error: any) {
    console.error('生成Word文档失败:', error)

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '生成Word文档失败'
    })
  }
})