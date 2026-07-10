import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark } from "@fortawesome/pro-regular-svg-icons";
import type { DemographicRing } from "#/data/listingDemographics";

let ringIdSuffix = 0;

function formatRingLabel(radiusMiles: number): string {
  const rounded = Math.round(radiusMiles * 100) / 100;
  return `${rounded} mi`;
}

export function RingsEditor({
  rings,
  onChange,
}: {
  rings: DemographicRing[];
  onChange: (rings: DemographicRing[]) => void;
}) {
  function updateRadius(id: string, radiusMiles: number) {
    onChange(
      rings.map((r) =>
        r.id === id ? { ...r, radiusMiles, label: formatRingLabel(radiusMiles) } : r,
      ),
    );
  }

  function removeRing(id: string) {
    if (rings.length <= 1) return;
    onChange(rings.filter((r) => r.id !== id));
  }

  function addRing() {
    const maxRadius = Math.max(0, ...rings.map((r) => r.radiusMiles));
    const radiusMiles = Math.round((maxRadius + 0.25) * 100) / 100;
    const id = `ring-${Date.now()}-${ringIdSuffix++}`;
    onChange([...rings, { id, radiusMiles, label: formatRingLabel(radiusMiles) }]);
  }

  return (
    <div className="d-flex flex-column gap-2">
      {rings.map((ring) => (
        <div key={ring.id} className="d-flex align-items-center gap-2">
          <InputGroup style={{ width: 110 }}>
            <Input
              type="number"
              step={0.05}
              min={0.05}
              value={ring.radiusMiles}
              onChange={(e) => updateRadius(ring.id, parseFloat(e.target.value) || 0)}
              aria-label={`${ring.label} radius, in miles`}
            />
            <InputGroup.Addon asText>mi</InputGroup.Addon>
          </InputGroup>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${ring.label} ring`}
            disabled={rings.length <= 1}
            onClick={() => removeRing(ring.id)}
          >
            <FontAwesomeIcon icon={faXmark} />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="align-self-start" onClick={addRing}>
        <FontAwesomeIcon icon={faPlus} />
        Add Ring
      </Button>
    </div>
  );
}
