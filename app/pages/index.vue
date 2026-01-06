<script setup lang="ts">
import type { PptxContent } from '~/server/utils/pptx-extractor'

const toast = useToast()

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
const showTemplateManager = ref(false)
const templateData = ref<Record<string, string>>({})

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
      <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-gray-900 mb-3">
          PPT课件内容提取工具
        </h1>
        <p class="text-lg text-gray-600">
          完整提取PPT课件中的所有文字内容
        </p>
      </div>

      <!-- 主要内容区域 -->
      <div class="grid gap-8 lg:grid-cols-2">
        <!-- 左侧：文件上传 -->
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold text-gray-900">
              上传PPT文件
            </h2>
          </template>

          <div class="space-y-6">
            <!-- 文件选择 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                选择PPT文件
              </label>
              <div
                class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
                @click="fileInput?.click()"
              >
                <div class="flex flex-col items-center gap-3">
                  <UIcon
                    name="i-heroicons-document-arrow-up"
                    class="w-12 h-12 text-gray-400"
                  />
                  <div>
                    <p class="text-sm text-gray-600">
                      {{ selectedFile ? selectedFile.name : '点击选择或拖拽PPT文件' }}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">
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
            </div>

            <!-- 操作按钮 -->
            <div class="flex gap-3">
              <UButton
                color="primary"
                size="lg"
                :loading="isExtracting"
                :disabled="!selectedFile"
                class="flex-1"
                @click="extractContent"
              >
                <UIcon name="i-heroicons-document-text" class="w-5 h-5 mr-2" />
                {{ isExtracting ? '提取中...' : '开始提取' }}
              </UButton>

              <UButton
                color="gray"
                variant="soft"
                size="lg"
                :disabled="!selectedFile && !extractedContent"
                @click="reset"
              >
                <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- 右侧：提取结果预览 -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">
                提取结果
              </h2>
              <UBadge
                v-if="extractedContent"
                color="green"
                variant="soft"
              >
                {{ extractedContent.totalSlides }} 张幻灯片
              </UBadge>
            </div>
          </template>

          <div v-if="!extractedContent" class="text-center py-12">
            <UIcon
              name="i-heroicons-document-text"
              class="w-16 h-16 text-gray-300 mx-auto mb-4"
            />
            <p class="text-gray-500">
              提取的内容将在这里显示
            </p>
          </div>

          <div v-else class="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            <!-- 元数据 -->
            <div v-if="extractedContent.metadata" class="bg-gray-50 rounded-lg p-4">
              <h3 class="font-semibold text-gray-900 mb-2">文档信息</h3>
              <div class="space-y-1 text-sm">
                <p v-if="extractedContent.metadata.title">
                  <span class="text-gray-600">标题：</span>
                  <span class="text-gray-900">{{ extractedContent.metadata.title }}</span>
                </p>
                <p v-if="extractedContent.metadata.author">
                  <span class="text-gray-600">作者：</span>
                  <span class="text-gray-900">{{ extractedContent.metadata.author }}</span>
                </p>
                <p v-if="extractedContent.metadata.subject">
                  <span class="text-gray-600">主题：</span>
                  <span class="text-gray-900">{{ extractedContent.metadata.subject }}</span>
                </p>
              </div>
            </div>

            <!-- 幻灯片内容 -->
            <div
              v-for="slide in extractedContent.slides"
              :key="slide.slideNumber"
              class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div class="flex items-start justify-between mb-3">
                <UBadge color="blue" variant="soft">
                  第 {{ slide.slideNumber }} 页
                </UBadge>
                <UButton
                  color="gray"
                  variant="ghost"
                  size="xs"
                  icon="i-heroicons-clipboard-document"
                  @click="copyContent(slide.texts.join('\n'))"
                />
              </div>

              <!-- 原始文本内容 -->
              <div v-if="slide.texts.length" class="space-y-2 bg-white rounded p-3">
                <p class="text-xs font-medium text-gray-500 mb-2">📄 原始内容</p>
                <div
                  v-for="(text, idx) in slide.texts"
                  :key="idx"
                  class="text-sm text-gray-900 pl-3 border-l-2 border-blue-200"
                >
                  {{ text }}
                </div>
              </div>

              <!-- 备注 -->
              <div v-if="slide.notes" class="mt-3 pt-3 border-t border-gray-100">
                <p class="text-xs font-medium text-gray-500 mb-1">💬 备注</p>
                <p class="text-sm text-gray-600">{{ slide.notes }}</p>
              </div>
            </div>

            <!-- 复制所有按钮 -->
            <div class="flex justify-end pt-4">
              <UButton
                color="blue"
                variant="soft"
                @click="copyAllContent"
              >
                <UIcon name="i-heroicons-clipboard-document-list" class="w-4 h-4 mr-2" />
                复制所有内容
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Word模板管理区域 -->
      <UCard class="mt-8">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900">
              📄 Word教案模板管理
            </h2>
            <UButton
              color="gray"
              variant="soft"
              size="sm"
              @click="showTemplateManager = !showTemplateManager"
            >
              {{ showTemplateManager ? '收起' : '展开' }}
            </UButton>
          </div>
        </template>

        <div v-if="showTemplateManager" class="space-y-6">
          <!-- 上传新模板 -->
          <div class="border-b pb-6">
            <h3 class="font-semibold text-gray-900 mb-4">上传新模板</h3>
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
                  @click="templateFileInput?.click()"
                >
                  <UIcon name="i-heroicons-document-plus" class="w-5 h-5 mr-2" />
                  {{ templateFile ? templateFile.name : '选择Word模板文件' }}
                </UButton>
              </div>
              <UButton
                color="primary"
                :loading="isUploadingTemplate"
                :disabled="!templateFile"
                @click="uploadTemplate"
              >
                上传模板
              </UButton>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              提示：模板中使用 <code class="bg-gray-100 px-1 rounded">{字段名}</code> 作为占位符，例如 {课程目标}, {教学重点}
            </p>
          </div>

          <!-- 模板列表 -->
          <div>
            <h3 class="font-semibold text-gray-900 mb-4">我的模板 ({{ templates.length }})</h3>

            <div v-if="templates.length === 0" class="text-center py-8 text-gray-500">
              暂无模板，请先上传Word模板文件
            </div>

            <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="template in templates"
                :key="template.id"
                class="border rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                :class="{ 'border-blue-500 bg-blue-50': selectedTemplate?.id === template.id }"
                @click="selectTemplate(template)"
              >
                <div class="flex items-start justify-between mb-2">
                  <h4 class="font-medium text-gray-900 text-sm truncate flex-1">
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
                  上传于 {{ new Date(template.uploadDate).toLocaleString('zh-CN') }}
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

          <!-- 填充模板表单 -->
          <div v-if="selectedTemplate" class="border-t pt-6">
            <h3 class="font-semibold text-gray-900 mb-4">填充模板字段</h3>
            <div class="grid gap-4 md:grid-cols-2">
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
                  :rows="3"
                />
              </div>
            </div>
            <div class="mt-6 flex justify-end">
              <UButton
                color="primary"
                size="lg"
                :loading="isGenerating"
                :disabled="!selectedTemplate"
                @click="generateDocument"
              >
                <UIcon name="i-heroicons-document-arrow-down" class="w-5 h-5 mr-2" />
                {{ isGenerating ? '生成中...' : '生成Word文档' }}
              </UButton>
            </div>
          </div>
        </div>
      </UCard>
    </UContainer>
  </div>
</template>