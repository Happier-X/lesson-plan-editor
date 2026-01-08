export const useDragDrop = (options?: {
  accept?: string
  maxSize?: number
  onFileSelect?: (file: File) => void
}) => {
  const isDragging = ref(false)
  const toast = useToast()

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    isDragging.value = true
  }

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()

    // 只有当拖拽完全离开区域时才设置为 false
    const target = event.currentTarget as HTMLElement
    const relatedTarget = event.relatedTarget as HTMLElement
    if (!target.contains(relatedTarget)) {
      isDragging.value = false
    }
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDrop = (event: DragEvent): File | null => {
    event.preventDefault()
    event.stopPropagation()
    isDragging.value = false

    const files = event.dataTransfer?.files
    if (!files || files.length === 0) {
      return null
    }

    const file = files[0]

    // 验证文件类型
    if (options?.accept) {
      const acceptedTypes = options.accept.split(',').map(t => t.trim())
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

      if (!acceptedTypes.some(type => fileExtension === type)) {
        toast.add({
          title: '文件格式错误',
          description: `仅支持 ${options.accept} 格式的文件`,
          color: 'red',
          timeout: 3000
        })
        return null
      }
    }

    // 验证文件大小
    if (options?.maxSize && file.size > options.maxSize) {
      const maxSizeMB = (options.maxSize / (1024 * 1024)).toFixed(2)
      toast.add({
        title: '文件过大',
        description: `文件大小不能超过 ${maxSizeMB}MB`,
        color: 'red',
        timeout: 3000
      })
      return null
    }

    // 调用回调函数
    if (options?.onFileSelect) {
      options.onFileSelect(file)
    }

    return file
  }

  return {
    isDragging: readonly(isDragging),
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  }
}
