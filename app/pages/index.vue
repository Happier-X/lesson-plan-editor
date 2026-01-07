<script setup lang="ts">
import type { PptxContent } from '~/server/utils/pptx-extractor'

// 扩展SlideContent类型以包含图片
interface SlideContent {
  slideNumber: number
  texts: string[]
  notes?: string
  rawTexts?: string[]
  images?: string[]
}

const toast = useToast()

// 步骤控制
const currentStep = ref(1)

// PPT提取相关状态
const selectedFile = ref<File | null>(null)
const isExtracting = ref(false)
const extractedContent = ref<PptxContent | null>(null)

// 模板管理相关状态
interface TemplateInfo {
  id: string
  name: string
  uploadDate: string
  placeholders: string[]
}

const templates = ref<TemplateInfo[]>([])
const selectedTemplate = ref<TemplateInfo | null>(null)
const templateFile = ref<File | null>(null)
const isUploadingTemplate = ref(false)
const isGenerating = ref(false)
const isSmartFilling = ref(false)
const templateData = ref<Record<string, string>>({})
const showPptContent = ref(true) // 默认展开PPT内容

// 步骤定义
const steps = [
  { number: 1, title: '上传PPT', description: '选择并上传PPT文件' },
  { number: 2, title: '解析PPT', description: '提取PPT内容' },
  { number: 3, title: '选择模板', description: '选择或上传Word模板' },
  { number: 4, title: '智能填充', description: 'AI智能填充字段' },
  { number: 5, title: '导出文档', description: '生成并下载Word文档' }
]

// 计算步骤是否可用
const isStepAccessible = (stepNumber: number) => {
  if (stepNumber === 1) return true
  if (stepNumber === 2) return selectedFile.value !== null
  if (stepNumber === 3) return extractedContent.value !== null
  if (stepNumber === 4) return selectedTemplate.value !== null
  if (stepNumber === 5) return selectedTemplate.value !== null && Object.values(templateData.value).some(v => v)
  return false
}

// 计算属性：检查是否有图片
const hasImages = computed(() => {
  return extractedContent.value?.slides.some(slide => slide.images && slide.images.length > 0) || false
})

// 文件选择处理
const fileInput = ref<HTMLInputElement>()

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    if (!file.name.endsWith('.pptx')) {
      toast.add({
        title: '文件格式错误',
        description: '请选择.pptx格式的文件',
        color: 'red',
        timeout: 3000
      })
      return
    }

    selectedFile.value = file
    toast.add({
      title: '文件已选择',
      description: file.name,
      color: 'green',
      timeout: 2000
    })
  }
}

// 提取PPT内容
const extractContent = async () => {
  if (!selectedFile.value) {
    toast.add({
      title: '请先选择文件',
      description: '请选择一个.pptx文件',
      color: 'amber',
      timeout: 3000
    })
    return
  }

  isExtracting.value = true
  extractedContent.value = null

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    const response = await $fetch<{
      success: boolean
      data: {
        content: PptxContent
      }
    }>('/api/extract-pptx', {
      method: 'POST',
      body: formData
    })

    if (response.success) {
      extractedContent.value = response.data.content

      toast.add({
        title: '提取成功',
        description: `成功提取 ${response.data.content.totalSlides} 张幻灯片的完整内容`,
        color: 'green',
        timeout: 3000
      })

      // 自动进入下一步
      currentStep.value = 3
    }
  } catch (error: any) {
    console.error('提取失败:', error)
    toast.add({
      title: '提取失败',
      description: error.data?.message || '请稍后重试',
      color: 'red',
      timeout: 5000
    })
  } finally {
    isExtracting.value = false
  }
}

// 重置
const reset = () => {
  selectedFile.value = null
  extractedContent.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 复制内容
const copyContent = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.add({
    title: '已复制',
    description: '内容已复制到剪贴板',
    color: 'green',
    timeout: 2000
  })
}

// 复制所有内容
const copyAllContent = () => {
  if (!extractedContent.value) return

  const allText = extractedContent.value.slides.map(slide => {
    return `\n========== 第 ${slide.slideNumber} 页 ==========\n${slide.texts.join('\n')}${slide.notes ? `\n\n备注: ${slide.notes}` : ''}`
  }).join('\n\n')

  copyContent(allText)
}

// ========== 模板管理相关方法 ==========

// 加载模板列表
const loadTemplates = async () => {
  try {
    const response = await $fetch<{
      success: boolean
      data: TemplateInfo[]
    }>('/api/templates/list')

    if (response.success) {
      templates.value = response.data
    }
  } catch (error: any) {
    console.error('加载模板列表失败:', error)
  }
}

// 模板文件选择
const templateFileInput = ref<HTMLInputElement>()

const handleTemplateFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    if (!file.name.endsWith('.docx')) {
      toast.add({
        title: '文件格式错误',
        description: '请选择.docx格式的文件',
        color: 'red',
        timeout: 3000
      })
      return
    }

    templateFile.value = file
  }
}

// 上传模板
const uploadTemplate = async () => {
  if (!templateFile.value) {
    toast.add({
      title: '请先选择模板文件',
      description: '请选择一个.docx文件',
      color: 'amber',
      timeout: 3000
    })
    return
  }

  isUploadingTemplate.value = true

  try {
    const formData = new FormData()
    formData.append('file', templateFile.value)

    const response = await $fetch<{
      success: boolean
      data: TemplateInfo
    }>('/api/templates/upload', {
      method: 'POST',
      body: formData
    })

    if (response.success) {
      toast.add({
        title: '上传成功',
        description: `模板已保存，识别到 ${response.data.placeholders.length} 个占位符`,
        color: 'green',
        timeout: 3000
      })

      templateFile.value = null
      if (templateFileInput.value) {
        templateFileInput.value.value = ''
      }

      await loadTemplates()
    }
  } catch (error: any) {
    console.error('上传模板失败:', error)
    toast.add({
      title: '上传失败',
      description: error.data?.message || '请稍后重试',
      color: 'red',
      timeout: 5000
    })
  } finally {
    isUploadingTemplate.value = false
  }
}

// 删除模板
const deleteTemplate = async (id: string) => {
  try {
    await $fetch(`/api/templates/${id}`, {
      method: 'DELETE'
    })

    toast.add({
      title: '删除成功',
      description: '模板已删除',
      color: 'green',
      timeout: 2000
    })

    await loadTemplates()

    if (selectedTemplate.value?.id === id) {
      selectedTemplate.value = null
      templateData.value = {}
    }
  } catch (error: any) {
    console.error('删除模板失败:', error)
    toast.add({
      title: '删除失败',
      description: error.data?.message || '请稍后重试',
      color: 'red',
      timeout: 5000
    })
  }
}

// 选择模板
const selectTemplate = (template: TemplateInfo) => {
  selectedTemplate.value = template
  // 初始化模板数据
  templateData.value = {}
  template.placeholders.forEach(placeholder => {
    templateData.value[placeholder] = ''
  })

  // 进入填充步骤
  currentStep.value = 4
}

// 智能填充
const smartFill = async () => {
  if (!selectedTemplate.value) {
    toast.add({
      title: '请选择模板',
      description: '请先选择一个Word模板',
      color: 'amber',
      timeout: 3000
    })
    return
  }

  if (!extractedContent.value) {
    toast.add({
      title: '请先提取PPT内容',
      description: '需要先上传并提取PPT内容才能使用智能填充',
      color: 'amber',
      timeout: 3000
    })
    return
  }

  isSmartFilling.value = true

  try {
    const response = await $fetch<{
      success: boolean
      data: Record<string, string>
    }>('/api/templates/smart-fill', {
      method: 'POST',
      body: {
        templateId: selectedTemplate.value.id,
        pptContent: extractedContent.value
      }
    })

    if (response.success) {
      // 填充数据到表单
      templateData.value = response.data

      toast.add({
        title: '智能填充成功',
        description: 'AI已根据PPT内容智能填充所有字段',
        color: 'green',
        timeout: 3000
      })
    }
  } catch (error: any) {
    console.error('智能填充失败:', error)
    toast.add({
      title: '智能填充失败',
      description: error.data?.message || '请稍后重试',
      color: 'red',
      timeout: 5000
    })
  } finally {
    isSmartFilling.value = false
  }
}

// 生成Word文档
const generateDocument = async () => {
  if (!selectedTemplate.value) {
    toast.add({
      title: '请选择模板',
      description: '请先选择一个Word模板',
      color: 'amber',
      timeout: 3000
    })
    return
  }

  // 检查是否所有字段都已填写
  const emptyFields = Object.entries(templateData.value)
    .filter(([_, value]) => !value || value.trim() === '')
    .map(([key]) => key)

  if (emptyFields.length > 0) {
    toast.add({
      title: '请填写所有字段',
      description: `以下字段未填写: ${emptyFields.join(', ')}`,
      color: 'amber',
      timeout: 5000
    })
    return
  }

  isGenerating.value = true

  try {
    const blob = await $fetch('/api/templates/generate', {
      method: 'POST',
      body: {
        templateId: selectedTemplate.value.id,
        data: templateData.value
      },
      responseType: 'blob'
    })

    // 下载文件
    const url = URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `教案_${Date.now()}.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.add({
      title: '生成成功',
      description: 'Word文档已生成并下载',
      color: 'green',
      timeout: 3000
    })
  } catch (error: any) {
    console.error('生成文档失败:', error)
    toast.add({
      title: '生成失败',
      description: error.data?.message || '请稍后重试',
      color: 'red',
      timeout: 5000
    })
  } finally {
    isGenerating.value = false
  }
}

// 页面加载时获取模板列表
onMounted(() => {
  loadTemplates()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
    <UContainer class="py-12">
      <!-- 标题区域 -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-3">
          教案生成器
        </h1>
        <p class="text-lg text-gray-600">
          提取PPT课件内容，智能生成教案文档
        </p>
      </div>

      <!-- 步骤指示器 -->
      <div class="mb-8">
        <div class="flex items-center justify-between max-w-4xl mx-auto">
          <div
            v-for="(step, index) in steps"
            :key="step.number"
            class="flex items-center"
            :class="{ 'flex-1': index < steps.length - 1 }"
          >
            <!-- 步骤圆圈 -->
            <div class="flex flex-col items-center">
              <button
                class="w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all relative"
                :class="[
                  currentStep === step.number
                    ? 'bg-blue-600 text-white shadow-lg scale-110'
                    : currentStep > step.number
                      ? 'bg-green-500 text-white'
                      : isStepAccessible(step.number)
                        ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                ]"
                :disabled="!isStepAccessible(step.number)"
                @click="isStepAccessible(step.number) && (currentStep = step.number)"
              >
                <span v-if="currentStep > step.number">✓</span>
                <span v-else>{{ step.number }}</span>
              </button>
              <div class="mt-2 text-center">
                <p class="text-sm font-medium text-gray-900">{{ step.title }}</p>
                <p class="text-xs text-gray-500 hidden sm:block">{{ step.description }}</p>
              </div>
            </div>

            <!-- 连接线 -->
            <div
              v-if="index < steps.length - 1"
              class="flex-1 h-1 mx-4 rounded"
              :class="currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'"
            />
          </div>
        </div>
      </div>

      <!-- 步骤内容区域 -->
      <UCard class="max-w-5xl mx-auto">
        <!-- 步骤 1: 上传PPT -->
        <div v-show="currentStep === 1">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">步骤 1: 上传PPT文件</h2>
            <p class="text-gray-600">选择您要转换为教案的PPT课件</p>
          </div>

          <div class="max-w-2xl mx-auto space-y-6">
            <div
              class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
              @click="fileInput?.click()"
            >
              <div class="flex flex-col items-center gap-4">
                <UIcon
                  name="i-heroicons-document-arrow-up"
                  class="w-16 h-16 text-gray-400"
                />
                <div>
                  <p class="text-lg text-gray-900 font-medium">
                    {{ selectedFile ? selectedFile.name : '点击选择或拖拽PPT文件' }}
                  </p>
                  <p class="text-sm text-gray-500 mt-2">
                    仅支持 .pptx 格式
                  </p>
                </div>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept=".pptx"
                class="hidden"
                @change="handleFileSelect"
              />
            </div>

            <div class="flex justify-end">
              <UButton
                color="primary"
                size="lg"
                :disabled="!selectedFile"
                @click="currentStep = 2"
              >
                下一步：解析PPT
                <UIcon name="i-heroicons-arrow-right" class="w-5 h-5 ml-2" />
              </UButton>
            </div>
          </div>
        </div>

        <!-- 步骤 2: 解析PPT -->
        <div v-show="currentStep === 2">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">步骤 2: 解析PPT内容</h2>
            <p class="text-gray-600">提取PPT中的文字、图片和备注信息</p>
          </div>

          <div class="max-w-3xl mx-auto">
            <div v-if="!extractedContent" class="text-center py-12">
              <UIcon
                name="i-heroicons-document-text"
                class="w-16 h-16 text-gray-300 mx-auto mb-4"
              />
              <p class="text-gray-600 mb-6">
                已选择文件: <span class="font-medium text-gray-900">{{ selectedFile?.name }}</span>
              </p>
              <UButton
                color="primary"
                size="lg"
                :loading="isExtracting"
                @click="extractContent"
              >
                <UIcon name="i-heroicons-sparkles" class="w-5 h-5 mr-2" />
                {{ isExtracting ? '解析中...' : '开始解析' }}
              </UButton>
            </div>

            <div v-else class="space-y-6">
              <!-- 提取结果摘要 -->
              <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                <div class="flex items-center gap-3 mb-4">
                  <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-green-600" />
                  <h3 class="text-lg font-semibold text-green-900">解析成功</h3>
                </div>
                <div class="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p class="text-2xl font-bold text-green-600">{{ extractedContent.totalSlides }}</p>
                    <p class="text-sm text-green-700">幻灯片</p>
                  </div>
                  <div>
                    <p class="text-2xl font-bold text-green-600">
                      {{ extractedContent.slides.reduce((sum, s) => sum + s.texts.length, 0) }}
                    </p>
                    <p class="text-sm text-green-700">文本段落</p>
                  </div>
                  <div>
                    <p class="text-2xl font-bold text-green-600">
                      {{ extractedContent.slides.reduce((sum, s) => sum + (s.images?.length || 0), 0) }}
                    </p>
                    <p class="text-sm text-green-700">图片</p>
                  </div>
                </div>
              </div>

              <!-- 内容预览 -->
              <div class="border rounded-lg p-4 max-h-96 overflow-y-auto">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="font-semibold text-gray-900">内容预览</h3>
                  <UButton
                    color="gray"
                    variant="soft"
                    size="xs"
                    @click="copyAllContent"
                  >
                    <UIcon name="i-heroicons-clipboard-document-list" class="w-4 h-4 mr-1" />
                    复制全部
                  </UButton>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="slide in extractedContent.slides.slice(0, 3)"
                    :key="slide.slideNumber"
                    class="border-l-4 border-blue-400 pl-3 py-2 bg-gray-50 rounded"
                  >
                    <p class="text-sm font-medium text-gray-600 mb-1">第 {{ slide.slideNumber }} 页</p>
                    <p class="text-sm text-gray-800 line-clamp-2">{{ slide.texts[0] }}</p>
                  </div>
                  <p v-if="extractedContent.slides.length > 3" class="text-xs text-gray-500 text-center">
                    还有 {{ extractedContent.slides.length - 3 }} 页内容...
                  </p>
                </div>
              </div>

              <div class="flex justify-between">
                <UButton
                  color="gray"
                  variant="soft"
                  size="lg"
                  @click="currentStep = 1"
                >
                  <UIcon name="i-heroicons-arrow-left" class="w-5 h-5 mr-2" />
                  上一步
                </UButton>
                <UButton
                  color="primary"
                  size="lg"
                  @click="currentStep = 3"
                >
                  下一步：选择模板
                  <UIcon name="i-heroicons-arrow-right" class="w-5 h-5 ml-2" />
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤 3: 选择模板 -->
        <div v-show="currentStep === 3">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">步骤 3: 选择Word模板</h2>
            <p class="text-gray-600">选择一个教案模板或上传自定义模板</p>
          </div>

          <div class="space-y-6">
            <!-- 上传新模板 -->
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <h3 class="font-semibold text-gray-900 mb-4">📤 上传新模板</h3>
              <div class="flex gap-3">
                <div class="flex-1">
                  <input
                    ref="templateFileInput"
                    type="file"
                    accept=".docx"
                    class="hidden"
                    @change="handleTemplateFileSelect"
                  />
                  <UButton
                    color="white"
                    block
                    size="lg"
                    @click="templateFileInput?.click()"
                  >
                    <UIcon name="i-heroicons-document-plus" class="w-5 h-5 mr-2" />
                    {{ templateFile ? templateFile.name : '选择Word模板文件 (.docx)' }}
                  </UButton>
                </div>
                <UButton
                  color="primary"
                  size="lg"
                  :loading="isUploadingTemplate"
                  :disabled="!templateFile"
                  @click="uploadTemplate"
                >
                  上传
                </UButton>
              </div>
              <p class="text-xs text-gray-500 mt-2">
                💡 提示：模板中使用 <code class="bg-gray-100 px-1 rounded">{字段名}</code> 作为占位符，例如 {课程目标}, {教学重点}
              </p>
            </div>

            <!-- 模板列表 -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-semibold text-gray-900">我的模板 ({{ templates.length }})</h3>
              </div>

              <div v-if="templates.length === 0" class="text-center py-12 bg-gray-50 rounded-lg">
                <UIcon name="i-heroicons-document" class="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p class="text-gray-600">暂无模板，请先上传Word模板文件</p>
              </div>

              <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div
                  v-for="template in templates"
                  :key="template.id"
                  class="border-2 rounded-lg p-4 hover:border-blue-400 transition-all cursor-pointer relative group"
                  :class="selectedTemplate?.id === template.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200'"
                  @click="selectTemplate(template)"
                >
                  <div class="flex items-start justify-between mb-2">
                    <h4 class="font-medium text-gray-900 text-sm truncate flex-1 flex items-center gap-2">
                      <span v-if="selectedTemplate?.id === template.id" class="text-blue-600">✓</span>
                      {{ template.name }}
                    </h4>
                    <UButton
                      color="red"
                      variant="ghost"
                      size="xs"
                      icon="i-heroicons-trash"
                      @click.stop="deleteTemplate(template.id)"
                    />
                  </div>
                  <p class="text-xs text-gray-500 mb-2">
                    {{ new Date(template.uploadDate).toLocaleDateString('zh-CN') }}
                  </p>
                  <div class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="placeholder in template.placeholders.slice(0, 3)"
                      :key="placeholder"
                      color="blue"
                      variant="soft"
                      size="xs"
                    >
                      {{ placeholder }}
                    </UBadge>
                    <UBadge
                      v-if="template.placeholders.length > 3"
                      color="gray"
                      variant="soft"
                      size="xs"
                    >
                      +{{ template.placeholders.length - 3 }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex justify-between pt-4">
              <UButton
                color="gray"
                variant="soft"
                size="lg"
                @click="currentStep = 2"
              >
                <UIcon name="i-heroicons-arrow-left" class="w-5 h-5 mr-2" />
                上一步
              </UButton>
              <UButton
                color="primary"
                size="lg"
                :disabled="!selectedTemplate"
              >
                下一步：智能填充
                <UIcon name="i-heroicons-arrow-right" class="w-5 h-5 ml-2" />
              </UButton>
            </div>
          </div>
        </div>

        <!-- 步骤 4: 智能填充 -->
        <div v-show="currentStep === 4">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">步骤 4: 填充模板字段</h2>
            <p class="text-gray-600">手动填写或使用AI智能填充</p>
          </div>

          <div v-if="selectedTemplate" class="space-y-6">
            <!-- PPT内容参考 -->
            <div v-if="extractedContent" class="border-2 border-blue-200 rounded-lg overflow-hidden">
              <div
                class="bg-blue-50 px-6 py-3 cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-between"
                @click="showPptContent = !showPptContent"
              >
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-blue-600" />
                  <h3 class="font-semibold text-gray-900">📄 PPT内容参考</h3>
                  <UBadge color="blue" variant="soft" size="xs">
                    点击{{ showPptContent ? '收起' : '展开' }}
                  </UBadge>
                </div>
                <UIcon
                  :name="showPptContent ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  class="w-5 h-5 text-gray-600"
                />
              </div>
              <div v-show="showPptContent" class="p-6 bg-white max-h-96 overflow-y-auto">
                <div class="space-y-4">
                  <div
                    v-for="slide in extractedContent.slides"
                    :key="slide.slideNumber"
                    class="border-l-4 border-blue-400 pl-4 py-2 bg-gray-50 rounded"
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <UBadge color="blue" variant="soft" size="xs">
                        第 {{ slide.slideNumber }} 页
                      </UBadge>
                      <UBadge v-if="slide.images && slide.images.length > 0" color="violet" variant="soft" size="xs">
                        📸 {{ slide.images.length }} 张图片
                      </UBadge>
                    </div>

                    <!-- 文本内容 -->
                    <div v-if="slide.texts.length" class="space-y-1 mb-2">
                      <div
                        v-for="(text, idx) in slide.texts"
                        :key="idx"
                        class="text-sm text-gray-800"
                      >
                        {{ text }}
                      </div>
                    </div>

                    <!-- 图片预览 -->
                    <div v-if="slide.images && slide.images.length > 0" class="grid grid-cols-3 gap-2 mt-2">
                      <img
                        v-for="(img, idx) in slide.images"
                        :key="idx"
                        :src="img"
                        :alt="`第${slide.slideNumber}页图片${idx + 1}`"
                        class="w-full h-20 object-contain bg-white rounded border border-gray-200"
                      />
                    </div>

                    <!-- 备注 -->
                    <div v-if="slide.notes" class="mt-2 pt-2 border-t border-gray-200">
                      <p class="text-xs font-medium text-gray-500 mb-1">💬 备注</p>
                      <p class="text-sm text-gray-600">{{ slide.notes }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- AI 智能填充大按钮 -->
            <div class="relative overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 opacity-5" />
              <div class="relative bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 border-2 border-violet-300 rounded-xl p-8 shadow-lg">
                <div class="text-center space-y-4">
                  <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full mb-2">
                    <UIcon name="i-heroicons-sparkles" class="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">🚀 一键AI智能填充</h3>
                    <p class="text-gray-700 max-w-2xl mx-auto">
                      让AI根据您上传的PPT内容自动分析并填充所有字段，省时省力！
                      {{ hasImages ? '（包含图片视觉分析）' : '' }}
                    </p>
                  </div>
                  <UButton
                    color="violet"
                    size="xl"
                    :loading="isSmartFilling"
                    @click="smartFill"
                    class="!text-lg !px-8 !py-4 shadow-lg hover:shadow-xl transition-all"
                  >
                    <UIcon name="i-heroicons-sparkles" class="w-6 h-6 mr-2" />
                    {{ isSmartFilling ? '正在AI智能填充中，请稍候...' : '立即使用AI智能填充' }}
                  </UButton>
                  <p class="text-xs text-gray-500">
                    填充后可以手动修改任何字段
                  </p>
                </div>
              </div>
            </div>

            <!-- 分割线 -->
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-4 bg-white text-gray-500">或手动填写字段</span>
              </div>
            </div>

            <!-- 字段填写表单 -->
            <div class="space-y-4">
              <div
                v-for="placeholder in selectedTemplate.placeholders"
                :key="placeholder"
                class="space-y-2"
              >
                <label class="block text-sm font-medium text-gray-700">
                  {{ placeholder }}
                </label>
                <UTextarea
                  v-model="templateData[placeholder]"
                  :placeholder="`请输入${placeholder}`"
                  :rows="4"
                  class="w-full"
                />
              </div>
            </div>

            <div class="flex justify-between pt-4">
              <UButton
                color="gray"
                variant="soft"
                size="lg"
                @click="currentStep = 3"
              >
                <UIcon name="i-heroicons-arrow-left" class="w-5 h-5 mr-2" />
                上一步
              </UButton>
              <UButton
                color="primary"
                size="lg"
                :disabled="!Object.values(templateData).some(v => v)"
                @click="currentStep = 5"
              >
                下一步：生成文档
                <UIcon name="i-heroicons-arrow-right" class="w-5 h-5 ml-2" />
              </UButton>
            </div>
          </div>
        </div>

        <!-- 步骤 5: 生成文档 -->
        <div v-show="currentStep === 5">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">步骤 5: 生成并导出文档</h2>
            <p class="text-gray-600">确认信息无误后生成Word教案</p>
          </div>

          <div v-if="selectedTemplate" class="space-y-6">
            <!-- 预览信息 -->
            <div class="border rounded-lg p-6 bg-gray-50">
              <h3 class="font-semibold text-gray-900 mb-4">📋 文档信息预览</h3>
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <span class="text-sm font-medium text-gray-600 w-24">选择模板:</span>
                  <span class="text-sm text-gray-900">{{ selectedTemplate.name }}</span>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-sm font-medium text-gray-600 w-24">字段数量:</span>
                  <span class="text-sm text-gray-900">{{ selectedTemplate.placeholders.length }} 个</span>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-sm font-medium text-gray-600 w-24">已填字段:</span>
                  <span class="text-sm text-gray-900">
                    {{ Object.values(templateData).filter(v => v).length }} / {{ selectedTemplate.placeholders.length }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 字段预览 -->
            <div class="border rounded-lg p-6 max-h-96 overflow-y-auto">
              <h3 class="font-semibold text-gray-900 mb-4">内容预览</h3>
              <div class="space-y-3">
                <div
                  v-for="[key, value] in Object.entries(templateData)"
                  :key="key"
                  class="border-l-4 border-blue-400 pl-3 py-2 bg-white rounded"
                >
                  <p class="text-sm font-medium text-gray-600 mb-1">{{ key }}</p>
                  <p class="text-sm text-gray-800">{{ value || '(未填写)' }}</p>
                </div>
              </div>
            </div>

            <!-- 警告提示 -->
            <div
              v-if="Object.entries(templateData).some(([_, v]) => !v)"
              class="bg-amber-50 border border-amber-200 rounded-lg p-4"
            >
              <div class="flex gap-3">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm font-medium text-amber-900">部分字段未填写</p>
                  <p class="text-sm text-amber-700 mt-1">
                    以下字段为空: {{ Object.entries(templateData).filter(([_, v]) => !v).map(([k]) => k).join(', ') }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex justify-between pt-4">
              <UButton
                color="gray"
                variant="soft"
                size="lg"
                @click="currentStep = 4"
              >
                <UIcon name="i-heroicons-arrow-left" class="w-5 h-5 mr-2" />
                上一步
              </UButton>
              <UButton
                color="primary"
                size="lg"
                :loading="isGenerating"
                @click="generateDocument"
              >
                <UIcon name="i-heroicons-document-arrow-down" class="w-5 h-5 mr-2" />
                {{ isGenerating ? '生成中...' : '生成并下载文档' }}
              </UButton>
            </div>
          </div>
        </div>
      </UCard>
    </UContainer>
  </div>
</template>