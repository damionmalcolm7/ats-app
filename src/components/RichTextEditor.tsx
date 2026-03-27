import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export default function RichTextEditor({ value, onChange, placeholder = 'Start typing...', minHeight = '200px' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value])

  if (!editor) return null

  const ToolbarButton = ({ onClick, active, title, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'rgba(37,99,235,0.2)' : 'transparent',
        border: active ? '1px solid rgba(37,99,235,0.4)' : '1px solid transparent',
        borderRadius: '5px',
        color: active ? '#3b82f6' : 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '0.3rem 0.5rem',
        fontSize: '0.8125rem',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '28px',
        transition: 'all 0.15s'
      }}
    >
      {children}
    </button>
  )

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--navy-800)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.125rem', padding: '0.5rem 0.625rem', borderBottom: '1px solid var(--border)', background: 'var(--navy-900)' }}>
        {/* Text formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><strong>B</strong></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><span style={{ textDecoration: 'underline' }}>U</span></ToolbarButton>

        <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.25rem' }} />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolbarButton>

        <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.25rem' }} />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">• List</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">1. List</ToolbarButton>

        <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.25rem' }} />

        {/* Block quote */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">"</ToolbarButton>

        {/* Horizontal rule */}
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divider">—</ToolbarButton>

        <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.25rem' }} />

        {/* Undo/Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} active={false} title="Undo">↩</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} active={false} title="Redo">↪</ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        style={{ minHeight, padding: '0.75rem 0.875rem', color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.7, outline: 'none' }}
      />

      <style>{`
        .ProseMirror { outline: none; }
        .ProseMirror p { margin: 0 0 0.5rem; }
        .ProseMirror h2 { font-size: 1.125rem; font-weight: 700; margin: 0.875rem 0 0.375rem; color: var(--text-primary); }
        .ProseMirror h3 { font-size: 1rem; font-weight: 600; margin: 0.75rem 0 0.375rem; color: var(--text-primary); }
        .ProseMirror ul { padding-left: 1.25rem; margin: 0.375rem 0; }
        .ProseMirror ol { padding-left: 1.25rem; margin: 0.375rem 0; }
        .ProseMirror li { margin-bottom: 0.25rem; color: var(--text-secondary); }
        .ProseMirror blockquote { border-left: 3px solid var(--blue-500); padding-left: 0.875rem; color: var(--text-muted); margin: 0.5rem 0; }
        .ProseMirror hr { border: none; border-top: 1px solid var(--border); margin: 0.875rem 0; }
        .ProseMirror strong { color: var(--text-primary); }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; float: left; height: 0; }
      `}</style>
    </div>
  )
}
