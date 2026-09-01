import { afterEach, describe, expect, it } from 'vitest'
import { useDataStore } from '#/data/dataStore'
import { createTask } from '#/data/actions'
import { listAllTasks } from '#/data/selectors'
import { setNotifier, type NotifyItem } from '#/lib/notify'
import { runUndo, useUndo } from '#/lib/undo'
import { useContactSession } from '#/components/contacts/useContactSession'
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
  useContactSession.setState({ logged: {} })
})

/** The session timeline rows written for a contact, newest first. */
function timelineFor(contactId: string) {
  return useContactSession.getState().logged[contactId] ?? []
}

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

/**
 * Completing a task is activity on the person it belongs to. Without this the
 * row just left the open list — checked off from the Tasks page, the dashboard
 * or Otto's day plan, it never reached the record it was about.
 */
describe('toggleTaskCompleted timeline row', () => {
  it('writes a Task completed row on the linked contact', () => {
    captureToasts()
    const { task } = createTask({ name: 'Send the comps', contactId: 'c-1' })

    toggleTaskCompleted(viewFor(task.id))

    const rows = timelineFor('c-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('task')
    expect(rows[0]?.body).toBe('Send the comps')
  })

  // Otherwise undo walks back the checkbox and leaves a "Task completed" row
  // standing for a task that is open again.
  it('undo retracts the row with the checkbox', () => {
    captureToasts()
    const { task } = createTask({ name: 'Order signage', contactId: 'c-2' })

    toggleTaskCompleted(viewFor(task.id))
    expect(timelineFor('c-2')).toHaveLength(1)

    runUndo()
    expect(timelineFor('c-2')).toHaveLength(0)
  })

  it('un-checking by hand retracts it too', () => {
    captureToasts()
    const { task } = createTask({ name: 'Book the tour', contactId: 'c-3' })
    toggleTaskCompleted(viewFor(task.id))
    useUndo.setState({ pending: null })

    toggleTaskCompleted(viewFor(task.id))

    expect(timelineFor('c-3')).toHaveLength(0)
  })

  // A deal task belongs to the deal — there is no person whose record it is,
  // and inventing one would put it on somebody's timeline at random.
  it('leaves a task with no linked contact alone', () => {
    captureToasts()
    const { task } = createTask({ name: 'Upload the survey' })

    toggleTaskCompleted(viewFor(task.id))

    expect(Object.values(useContactSession.getState().logged).flat()).toHaveLength(0)
  })
})

describe('runUndo', () => {
  it('does nothing when no offer is outstanding', () => {
    expect(() => runUndo()).not.toThrow()
  })
})
