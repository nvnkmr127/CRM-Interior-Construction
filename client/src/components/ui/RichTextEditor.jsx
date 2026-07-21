import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useState, useRef, useEffect } from 'react'
import styles from './RichTextEditor.module.css'

const MenuBar = ({ editor, toggleFullscreen, isFullscreen }) => {
  if (!editor) return null

  const addImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (readerEvent) => {
          editor.chain().focus().setImage({ src: readerEvent.target.result }).run()
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className={styles.toolbar}>
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? styles.active : ''}>
        <b>B</b>
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? styles.active : ''}>
        <i>I</i>
      </button>
      <div className={styles.divider} />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? styles.active : ''}>
        • List
      </button>
    </div>
  )
}

export default function RichTextEditor({ value, onChange }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)
  const isInternalChange = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      isInternalChange.current = true;
      onChange(editor.getHTML())
    }
  })

  // Update content if value changes externally (e.g. initial load)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      if (!isInternalChange.current) {
        editor.commands.setContent(value)
      }
      isInternalChange.current = false;
    }
  }, [value, editor])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isFullscreen])

  return (
    <div ref={containerRef} className={`${styles.editorContainer} ${isFullscreen ? styles.fullscreen : ''}`}>
      <MenuBar editor={editor} toggleFullscreen={() => setIsFullscreen(!isFullscreen)} isFullscreen={isFullscreen} />
      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  )
}
