import { templateManager } from '../../utils/get-template-manager'

export default defineEventHandler(async () => {
  try {
    const templates = await templateManager.listTemplates()

    return {
      success: true,
      data: templates
    }
  } catch (error: any) {
    console.error('获取模板列表失败:', error)

    throw createError({
      statusCode: 500,
      message: '获取模板列表失败'
    })
  }
})