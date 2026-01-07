import { templateManager } from '../../utils/get-template-manager'

export default defineEventHandler(async (event) => {
  try {
    const formData = await readFormData(event)
    const file = formData.get('file') as File

    if (!file) {
      throw createError({
        statusCode: 400,
        message: '请上传Word模板文件'
      })
    }

    // 验证文件类型
    if (!file.name.endsWith('.docx')) {
      throw createError({
        statusCode: 400,
        message: '仅支持.docx格式的文件'
      })
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 保存模板
    const templateInfo = await templateManager.saveTemplate(buffer, file.name)

    return {
      success: true,
      data: templateInfo
    }
  } catch (error: any) {
    console.error('上传模板失败:', error)

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '上传模板失败'
    })
  }
})