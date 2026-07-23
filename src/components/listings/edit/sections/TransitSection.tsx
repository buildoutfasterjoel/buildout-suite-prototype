import {
	faBusSimple,
	faTrain,
	faTrainSubway,
	faTrainTram,
} from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Section } from "#/components/listings/listingWidgets";

const NEARBY_TRANSIT = [
	{
		icon: faTrainSubway,
		name: "Metro Blue Line — Downtown Station",
		distance: "0.3 mi",
	},
	{
		icon: faTrainTram,
		name: "Riverside Streetcar — 4th & Main",
		distance: "0.5 mi",
	},
	{ icon: faBusSimple, name: "Route 22 Express Bus", distance: "0.2 mi" },
	{
		icon: faTrain,
		name: "Regional Rail — Central Station",
		distance: "1.1 mi",
	},
];

/**
 * Listing tab — Transit. A static, read-only rundown of representative
 * nearby transit lines; there's no editable state to wire up here yet.
 */
export function TransitSection() {
	return (
		<Section title="Transit" icon={faTrainSubway}>
			<ul className="list-unstyled d-flex flex-column gap-2 mb-0">
				{NEARBY_TRANSIT.map((line) => (
					<li
						key={line.name}
						className="d-flex align-items-center justify-content-between gap-3 py-1 border-bottom"
					>
						<span className="d-flex align-items-center gap-2">
							<FontAwesomeIcon icon={line.icon} className="text-muted" />
							{line.name}
						</span>
						<span className="text-muted">{line.distance}</span>
					</li>
				))}
			</ul>
		</Section>
	);
}
