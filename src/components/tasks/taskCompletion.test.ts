import { afterEach, describe, expect, it } from 'vitest'
import { useDataStore } from '#/data/dataStore'
import { createTask } from '#/data/actions'
import { listAllTasks } from '#/data/selectors'
import { setNotifier, type NotifyItem } from '#/lib/notify'
import { runUndo, useUndo } from '#/lib/undo'
import { toggleTaskCompleted } from './taskCompletion'

/** Collect toasts so the assertions can read what the user would have seen. */
function captureToasts(): NotifyItem[] {
  const items: NotifyItem[] = []
  setNotifier({
    show: (i) => {
      items.push(i)
      return `toast-${items.length}`
    },
    dismiss: () => {},
  })
  return items
}

function viewFor(id: string) {
  const view = listAllTasks().find((t) => t.id === id)
  if (!view) throw new Error(`no task view for ${id}`)
  return view
}

afterEach(() => {
  setNotifier(null)
  useUndo.setState({ pending: null })
})

describe('toggleTaskCompleted', () => {
  it('completes the task and offers an undo naming it', () => {
    const toasts = captureToasts()
    const { task } = createTask({ name: 'Send the LOI' })

    toggleTaskCompleted(viewFor(task.id))

    expect(useDataStore.getState().tasks.get(task.id)?.status).toBe('complete')
    expect(toasts).toHaveLength(1)
    expect(toasts[0]?.title).toBe('Task completed')
    expect(toasts[0]?.description).toContain('Send the LOI')
    expect(toasts[0]?.action?.label).toBe('Undo')
  })

  it('undo puts the task back', () => {
    captureToasts()
    const { task } = createTask({ name: 'Book the tour' })

    toggleTaskCompleted(viewFor(task.id))
    expect(useDataStore.getState().tasks.get(task.id)?.status).toBe('complete')

    runUndo()
    expect(useDataStore.getState().tasks.get(task.id)?.status).toBe('open')
    // The offer is spent — a second chord must not re-fire it.
    expect(useUndo.getState().pending).toBeNull()
  })

  it('un-checking is itself the correction, so it stays silent', () => {
    const toasts = captureToasts()
    const { task } = createTask({ name: 'Call the seller' })
    toggleTaskCompleted(viewFor(task.id))
    toasts.length = 0
    useUndo.setState({ pending: null })

    toggleTaskCompleted(viewFor(task.id))

    expect(useDataStore.getState().tasks.get(task.id)?.status).toBe('open')
    expect(toasts).toHaveLength(0)
    expect(useUndo.getState().pending).toBeNull()
  })

  it('a second completion replaces the first offer, so the chord undoes the newest', () => {
    captureToasts()
    const { task: first } = createTask({ name: 'First' })
    const { task: second } = createTask({ name: 'Second' })

    toggleTaskCompleted(viewFor(first.id))
    toggleTaskCompleted(viewFor(second.id))
    runUndo()

    expect(useDataStore.getState().tasks.get(second.id)?.status).toBe('open')
    expect(useDataStore.getState().tasks.get(first.id)?.status).toBe('complete')
  })
})

describe('runUndo', () => {
  it('does nothing when no offer is outstanding', () => {
    expect(() => runUndo()).not.toThrow()
  })
})
