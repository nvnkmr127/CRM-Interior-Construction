import { useState, useEffect } from 'react'
import { configApi } from '../../api/config'
import { useToast } from '../../store/toastContext'
import { Button, Input, Select, Modal } from '../../components/ui'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import DOMPurify from 'dompurify'

const AVAILABLE_TEMPLATES = [
  { key: 'member_added', label: 'Welcome (Member Added)', variables: ['name', 'tempPassword', 'setupUrl'] },
  { key: 'approval_request', label: 'Approval Request', variables: ['name', 'role', 'reviewUrl'] },
  { key: 'approval_granted', label: 'Approval Granted', variables: ['name', 'loginUrl'] },
  { key: 'approval_rejected', label: 'Approval Rejected', variables: ['name', 'reason'] },
  { key: 'welcome_email', label: 'Welcome Email', variables: ['name', 'dashboardUrl'] },
  { key: 'password_reset', label: 'Password Reset', variables: ['name', 'resetUrl'] },
  { key: 'role_changed', label: 'Role Change', variables: ['name', 'newRole'] },
  { key: 'permission_updated', label: 'Permission Change', variables: ['name'] },
  { key: 'birthday', label: 'Birthday', variables: ['name'] },
  { key: 'work_anniversary', label: 'Work Anniversary', variables: ['name', 'years'] },
  { key: 'account_deactivated', label: 'Termination / Deactivation', variables: ['name'] },
]

export default function EmailTemplateBuilder() {
  const [templates, setTemplates] = useState([])
  const [selectedKey, setSelectedKey] = useState(AVAILABLE_TEMPLATES[0].key)
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  
  const toast = useToast()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: htmlContent,
    onUpdate: ({ editor }) => {
      setHtmlContent(editor.getHTML())
    }
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    if (!editor) return
    const current = templates.find(t => t.template_key === selectedKey)
    if (current) {
      setSubject(current.subject)
      setHtmlContent(current.html_content)
      editor.commands.setContent(current.html_content)
    } else {
      setSubject('')
      setHtmlContent('')
      editor.commands.setContent('')
    }
  }, [selectedKey, templates, editor])

  const loadTemplates = async () => {
    try {
      const data = await configApi.getEmailTemplates()
      setTemplates(data || [])
    } catch (err) {
      toast.error('Failed to load templates')
    }
  }

  const handleSave = async () => {
    if (!subject) return toast.error('Subject is required')
    try {
      await configApi.saveEmailTemplate({
        template_key: selectedKey,
        subject,
        html_content: htmlContent
      })
      toast.success('Template saved successfully')
      loadTemplates()
    } catch (err) {
      toast.error('Failed to save template')
    }
  }

  const handleTest = async () => {
    if (!testEmail || !subject) return toast.error('Test email and subject are required')
    try {
      await configApi.testEmailTemplate({
        recipient_email: testEmail,
        subject,
        html_content: htmlContent
      })
      toast.success('Test email queued')
      setIsTestModalOpen(false)
    } catch (err) {
      toast.error('Failed to queue test email')
    }
  }

  const insertVariable = (variable) => {
    if (editor) {
      editor.commands.insertContent(`{{${variable}}}`)
    }
  }

  const currentTemplateInfo = AVAILABLE_TEMPLATES.find(t => t.key === selectedKey)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '24px', height: 'calc(100vh - 120px)' }}>
      {/* Sidebar */}
      <div style={{ background: 'var(--color-background-soft)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: '16px', fontWeight: 600 }}>Templates</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {AVAILABLE_TEMPLATES.map(t => {
            const hasCustom = templates.some(ct => ct.template_key === t.key)
            return (
              <div 
                key={t.key}
                onClick={() => setSelectedKey(t.key)}
                style={{ 
                  padding: '10px 12px', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  background: selectedKey === t.key ? 'var(--color-primary)' : 'transparent',
                  color: selectedKey === t.key ? 'white' : 'var(--color-text)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '14px'
                }}
              >
                {t.label}
                {hasCustom && <span style={{ fontSize: '10px', background: 'var(--color-success)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Custom</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Editor Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Edit {currentTemplateInfo?.label}</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" onClick={() => setIsPreview(!isPreview)}>
              {isPreview ? 'Edit Mode' : 'Live Preview'}
            </Button>
            <Button variant="secondary" onClick={() => setIsTestModalOpen(true)}>Send Test</Button>
            <Button variant="primary" onClick={handleSave}>Save Template</Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Email Subject</label>
              <Input 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                placeholder="Enter email subject..."
                disabled={isPreview}
              />
            </div>

            {isPreview ? (
              <div 
                style={{ 
                  flex: 1, 
                  border: '1px solid var(--color-border)', 
                  borderRadius: '8px', 
                  padding: '32px',
                  background: '#f9fafb',
                  overflowY: 'auto'
                }}
              >
                {/* Mock a standard email wrapper layout for preview */}
                <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                  <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
                    <h1 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>Your Company</h1>
                  </div>
                  <div 
                    style={{ padding: '24px', color: '#374151', fontSize: '16px', lineHeight: '1.5' }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent || '<p>No content provided yet.</p>') }}
                  />
                  <div style={{ padding: '24px', background: '#f3f4f6', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                    © 2026 Your Company. All rights reserved.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-soft)', display: 'flex', gap: '8px' }}>
                  <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Button>
                  <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Button>
                  <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Button>
                  <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleBulletList().run()}>List</Button>
                </div>
                <div style={{ padding: '16px', flex: 1, overflowY: 'auto', background: 'var(--color-background)' }}>
                  <EditorContent editor={editor} style={{ minHeight: '300px' }} />
                </div>
              </div>
            )}
          </div>

          {!isPreview && (
            <div style={{ width: '250px', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', background: 'var(--color-background-soft)' }}>
              <h4 style={{ marginBottom: '16px', fontWeight: 600 }}>Variables</h4>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Click to insert dynamically replaced variables.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentTemplateInfo?.variables.map(v => (
                  <Button key={v} variant="secondary" size="sm" style={{ justifyContent: 'flex-start' }} onClick={() => insertVariable(v)}>
                    {`{{${v}}}`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isTestModalOpen} onClose={() => setIsTestModalOpen(false)} title="Send Test Email">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Send a mock email using the current editor contents to verify the layout.</p>
          <Input 
            type="email" 
            placeholder="Recipient email address" 
            value={testEmail} 
            onChange={(e) => setTestEmail(e.target.value)} 
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button variant="ghost" onClick={() => setIsTestModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleTest}>Queue Email</Button>
          </div>
        </div>
      </Modal>

      <style>{`
        .ProseMirror { outline: none; }
        .ProseMirror p { margin: 0 0 1em 0; }
        .ProseMirror h2 { margin: 0 0 0.5em 0; font-size: 1.5em; font-weight: bold; }
        .ProseMirror ul { padding-left: 1.5em; margin: 0 0 1em 0; }
        .ProseMirror li { margin-bottom: 0.5em; }
        .ProseMirror a { color: var(--color-primary); text-decoration: underline; }
      `}</style>
    </div>
  )
}
