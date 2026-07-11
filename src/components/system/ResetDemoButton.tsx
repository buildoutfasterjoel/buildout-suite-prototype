import { Button } from '@buildoutinc/blueprint-react/ui/Button'
import { faArrowsRotate } from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useDataStore } from '#/data/dataStore'

/** Wipes the demo world back to the deterministic clean state (keeps the session). */
export function ResetDemoButton() {
  const reset = useDataStore((s) => s.reset)
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await reset()
        window.location.reload()
      }}
    >
      <FontAwesomeIcon icon={faArrowsRotate} />
      Reset demo
    </Button>
  )
}
