import { extractPptxContent } from '../utils/pptx-extractor'

export default defineEventHandler(async (event) => {
  try {
    const formData = await readFormData(event)
    const file = formData.get('file') as File

    if (!file) {
      throw createError({
        statusCode: 400,
        message: '请上传PPT文件'
      })
    }

    // 验证文件类型
    if (!file.name.endsWith('.pptx')) {
      throw createError({
        statusCode: 400,
        message: '仅支持.pptx格式的文件'
      })
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 提取PPT内容（原封不动）
    const content = await extractPptxContent(buffer)

    return {
      success: true,
      data: {
        content  // 原始提取的内容
      }
    }
  } catch (error: any) {
    console.error('提取PPT内容失败:', error)

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '提取PPT内容失败'
    })
  }
})