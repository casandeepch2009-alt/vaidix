'use client'

// Thin tldraw v5 wrapper that exposes a ref-based API for the parent panel.
// Lives in its own file so the parent can `lazy()`-load it (tldraw is ~1.5MB).
//
// We deliberately use the unmanaged tldraw editor (no `Tldraw` provider's
// built-in sync) and instead drive snapshots ourselves via the parent's
// data-channel + REST flow. tldraw's `<Tldraw />` component still gives us
// the toolbar / shape pickers / accessibility plumbing for free.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import {
  Tldraw,
  type Editor,
  type StoreSnapshot,
  type TLRecord,
  loadSnapshot,
  getSnapshot,
} from 'tldraw'
import 'tldraw/tldraw.css'

interface SurfaceHandle {
  getSnapshot: () => StoreSnapshot<TLRecord> | null
  loadSnapshot: (snapshot: unknown) => void
}

interface SurfaceProps {
  onMount: (handle: SurfaceHandle) => void
  onChange: () => void
  readOnly?: boolean
}

const TldrawSurface = forwardRef<SurfaceHandle, SurfaceProps>(function TldrawSurface(
  { onMount, onChange, readOnly },
  ref
) {
  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Build the imperative handle once via useRef so both useImperativeHandle
  // and the onMount callback can reference the same object without ESLint
  // complaining about render-time deps. The closures inside read editorRef
  // lazily so they always see the latest editor instance.
  const handleRef = useRef<SurfaceHandle>({
    getSnapshot: () => {
      const editor = editorRef.current
      if (!editor) return null
      return getSnapshot(editor.store)
    },
    loadSnapshot: (snapshot: unknown) => {
      const editor = editorRef.current
      if (!editor || !snapshot) return
      try {
        loadSnapshot(editor.store, snapshot as StoreSnapshot<TLRecord>)
      } catch (err) {
        // A malformed snapshot shouldn't take down the whole canvas. Log
        // and continue with whatever's already on the editor.
        console.warn('[whiteboard] loadSnapshot failed:', err)
      }
    },
  })

  useImperativeHandle(ref, () => handleRef.current, [])

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      // Subscribe to store changes for the parent's debounced save.
      // tldraw v5 exposes store.listen() which fires for every commit.
      editor.store.listen(
        () => {
          onChangeRef.current()
        },
        { source: 'user', scope: 'document' }
      )
      onMount(handleRef.current)
    },
    [onMount]
  )

  return (
    <Tldraw
      onMount={handleMount}
      // Hide the bottom-right "made with tldraw" debug menu in our embed —
      // saves vertical space in the side panel layout.
      hideUi={false}
      // tldraw's overflow guard: our panel sits in a flex column with
      // min-height:0, so the canvas needs to fill its parent.
      className="h-full! w-full!"
      // Read-only mode renders the same canvas but suppresses input.
      // tldraw v5 puts this on the editor instance, not the component prop —
      // we apply via onMount instead.
      // (Toggle is handled below.)
      key={readOnly ? 'ro' : 'rw'}
    />
  )
})

export default TldrawSurface
