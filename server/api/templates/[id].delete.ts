import { templateManager } from '../../utils/template-manager'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({
        statusCode: 400,
        message: '模板ID不能为空'
      })
    }

    const success = await templateManager.deleteTemplate(id)

    if (!success) {
      throw createError({
        statusCode: 404,
        message: '模板不存在'
      })
    }

    return {
      success: true,
      message: '删除成功'
    }
  } catch (error: any) {
    console.error('删除模板失败:', error)

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '删除模板失败'
    })
  }
})