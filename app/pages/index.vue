<script setup lang="ts">
import type { PptxContent } from '~/server/utils/pptx-extractor'

const toast = useToast()

// 状态管理
const selectedFile = ref<File | null>(null)
const isExtracting = ref(false)
const extractedContent = ref<PptxContent | null>(null)

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
    </UContainer>
  </div>
</template>