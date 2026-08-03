import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import {
	Col,
	FieldGrid,
	SelectField,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import { emptyVisualMediaLink } from "#/data/createListing";
import { mediaForUnit } from "#/data/unitScopedMarketing";
import type { DealMarketing, VisualMediaType } from "#/data/types";

const VISUAL_MEDIA_TYPES: VisualMediaType[] = [
	"Interactive Site Plan",
	"Aerial 360 Map",
	"Aerial 360 Rendering",
	"360 Rendering",
	"Property Marketing Video",
	"Matterport Tour",
	"360 Tour",
];

/**
 * Listing tab — Visual Media. Repeatable rows of virtual-tour / rendering
 * embeds on `marketing.visualMedia` — each row a public URL + media type.
 */
export function VisualMediaSection({
	marketing,
	patchMarketing,
	unitId,
}: {
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	/**
	 * Scope to a single space deal — shows its own tagged assets plus the
	 * building-wide ones (unlike Leads, media falls back: a suite with no
	 * photos of its own should still show the building's). Omitted (or null)
	 * shows the whole library, unfiltered.
	 */
	unitId?: string | null;
}) {
	const allLinks = marketing.visualMedia ?? [];
	const links = mediaForUnit(allLinks, unitId ?? null);

	const update = (id: string, patch: Partial<(typeof allLinks)[number]>) =>
		patchMarketing({
			visualMedia: allLinks.map((l) => (l.id === id ? { ...l, ...patch } : l)),
		});
	const add = () =>
		patchMarketing({
			visualMedia: [...allLinks, emptyVisualMediaLink(unitId ?? null)],
		});
	const remove = (id: string) =>
		patchMarketing({ visualMedia: allLinks.filter((l) => l.id !== id) });

	return (
		<Section
			title="Visual Media"
			icon={faImage}
			action={
				<Button variant="ghost" size="sm" onClick={add}>
					<FontAwesomeIcon icon={faPlus} />
					Add media
				</Button>
			}
		>
			{unitId && (
				<Alert severity="info" withIcon className="mb-3">
					<FontAwesomeIcon icon={faCircleInfo} />
					Showing {links.length} of {allLinks.length} — filtered to this
					space. The full library lives on the building.
				</Alert>
			)}
			{links.length === 0 ? (
				<p className="text-muted mb-0">
					No visual media links added to this listing.
				</p>
			) : (
				<div className="d-flex flex-column gap-3">
					{links.map((link) => (
						<div
							key={link.id}
							className="d-flex align-items-end gap-2 border rounded p-3"
							style={{ borderRadius: 6 }}
						>
							<div className="flex-grow-1">
								<FieldGrid>
									<Col>
										<TextField
											label="Public URL"
											value={link.url}
											onChange={(v) => update(link.id, { url: v })}
											placeholder="https://…"
										/>
									</Col>
									<Col>
										<SelectField
											label="Media Type"
											value={link.mediaType}
											options={VISUAL_MEDIA_TYPES}
											onChange={(v) => update(link.id, { mediaType: v })}
										/>
									</Col>
								</FieldGrid>
							</div>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Remove media link"
								onClick={() => remove(link.id)}
							>
								<FontAwesomeIcon icon={faTrashCan} />
							</Button>
						</div>
					))}
				</div>
			)}
		</Section>
	);
}
