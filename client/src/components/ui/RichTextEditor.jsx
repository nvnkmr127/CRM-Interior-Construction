import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Mention from '@tiptap/extension-mention'
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
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? styles.active : ''}>
        <s>S</s>
      </button>
      <div className={styles.divider} />
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? styles.active : ''}>
        H1
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? styles.active : ''}>
        H2
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? styles.active : ''}>
        H3
      </button>
      <div className={styles.divider} />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? styles.active : ''}>
        • List
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? styles.active : ''}>
        1. List
      </button>
      <div className={styles.divider} />
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? styles.active : ''}>
        "
      </button>
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? styles.active : ''}>
        &lt;/&gt;
      </button>
      <div className={styles.divider} />
      <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        Table
      </button>
      <button onClick={setLink} className={editor.isActive('link') ? styles.active : ''}>
        Link
      </button>
      <button onClick={addImage}>
        Image
      </button>
      <div className={styles.spacer} />
      <button onClick={toggleFullscreen} title="Toggle Fullscreen">
        {isFullscreen ? '⤓' : '⤢'}
      </button>
    </div>
  )
}

export default function RichTextEditor({ value, onChange }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Mention.configure({
        HTMLAttributes: { class: styles.mention },
        suggestion: {
          items: ({ query }) => {
            return ['Alice', 'Bob', 'Charlie', 'Dave'].filter(item => item.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5)
          },
        }
      })
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    }
  })

  // Update content if value changes externally (e.g. initial load)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
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
