import { Fragment, useMemo, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleUser,
  faMagnifyingGlass,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import type {
  ContactDealStage,
  ContactSource,
  DealSide,
  PropertyType,
  RelationshipStage,
} from "#/data/types";
import {
  CONTACT_DEAL_STAGES,
  CONTACT_SOURCES,
  DEAL_SIDES,
  DEAL_STAGE_DISPLAY,
  RELATIONSHIP_DISPLAY,
  RELATIONSHIP_STAGES,
  SIDE_DISPLAY,
} from "#/components/contacts/contactDisplay";
import { PROPERTY_TYPES, TYPE_LABELS } from "#/components/properties/propertyDisplay";
import {
  ALL,
  LAST_ACTIVITY_OPTIONS,
  LISTING_INQUIRY_OPTIONS,
  OPEN_TASKS_OPTIONS,
  type ContactFilterState,
} from "#/components/contacts/contactFilterModel";
import { getDealOptions } from "#/data/store";

interface ContactFilterFieldsProps {
  filters: ContactFilterState;
  onChange: (next: ContactFilterState) => void;
  assignees: string[];
  allTags: string[];
  /** Optional "search filters" query; when set, hides non-matching groups. */
  query?: string;
}

/** Immutable toggle helper for the multi-select checkbox groups. */
export function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Does this group's title or any option label match the filter-search query? */
function groupMatches(query: string, title: string, labels: string[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (title.toLowerCase().includes(q)) return true;
  return labels.some((l) => l.toLowerCase().includes(q));
}

/** A single full-row clickable checkbox option. */
function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="contact-filters__row d-flex align-items-center gap-2 mb-0 px-2 py-1 rounded-3">
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={label} />
      <span>{label}</span>
    </label>
  );
}

/** Section heading + optional description shared by every group. */
function GroupHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="d-flex flex-column gap-1">
      <span className="fw-bold">{title}</span>
      {description && <span className="text-muted fs-small">{description}</span>}
    </div>
  );
}

/**
 * The filter-group stack (Assigned To, Side, Contact Stage, … Do Not Call),
 * divider-delimited. Shell-agnostic: used by the Offcanvas flyout and the Edit
 * Dynamic List modal. Pass `query` to enable the "search filters" behavior.
 */
export function ContactFilterFields({
  filters,
  onChange,
  assignees,
  allTags,
  query = "",
}: ContactFilterFieldsProps) {
  const sideLabels = DEAL_SIDES.map((s) => SIDE_DISPLAY[s].label);
  const relLabels = RELATIONSHIP_STAGES.map((s) => RELATIONSHIP_DISPLAY[s].label);
  const dealLabels = CONTACT_DEAL_STAGES.map((s) => DEAL_STAGE_DISPLAY[s].label);
  const propLabels = PROPERTY_TYPES.map((t) => TYPE_LABELS[t]);
  const activityLabels = LAST_ACTIVITY_OPTIONS.map((o) => o.label);

  const tagValue = useMemo(() => [...filters.tags], [filters.tags]);

  // Listing lookup for the "Specific Listing" inquiry mode. Combobox is
  // string-keyed on the item text, so map label ↔ id both ways (mirrors the
  // Add Task modal's LookupField).
  const listingOptions = useMemo(() => getDealOptions(), []);
  const listingItems = useMemo(
    () => [...new Set(listingOptions.map((o) => o.label))],
    [listingOptions],
  );
  const listingIdByLabel = useMemo(
    () => new Map(listingOptions.map((o) => [o.label, o.value])),
    [listingOptions],
  );
  const listingLabelById = useMemo(
    () => new Map(listingOptions.map((o) => [o.value, o.label])),
    [listingOptions],
  );

  const set = (patch: Partial<ContactFilterState>) =>
    onChange({ ...filters, ...patch });

  // Per-group visibility driven by the optional "Search Filters" query.
  const show = {
    assignedTo: groupMatches(query, "Assigned To", assignees),
    side: groupMatches(query, "Side", sideLabels),
    relationship: groupMatches(query, "Contact Stage", relLabels),
    dealStage: groupMatches(query, "Deal Stage", dealLabels),
    lastActivity: groupMatches(query, "Last Activity", activityLabels),
    openTasks: groupMatches(query, "Open Tasks", []),
    listingInquiries: groupMatches(
      query,
      "Listing Inquiries",
      LISTING_INQUIRY_OPTIONS.map((o) => o.label),
    ),
    propertyType: groupMatches(query, "Property Type", propLabels),
    source: groupMatches(query, "Source", CONTACT_SOURCES),
    tags: groupMatches(query, "Tags", allTags),
    doNotCall: groupMatches(query, "Exclude contacts marked Do Not Call", []),
  };

  // Divider-delimited sections (matching the design's line groupings). Side +
  // Contact Stage + Deal Stage share one cluster with no dividers between them.
  const sections: { key: string; visible: boolean; node: ReactNode }[] = [
    {
      key: "assignedTo",
      visible: show.assignedTo,
      node: (
        <div className="d-flex flex-column gap-1">
          <span className="fw-bold">Assigned To</span>
          <Select
            value={filters.assignedTo}
            onValueChange={(v) => set({ assignedTo: v ?? ALL })}
          >
            <Select.Trigger>
              <span className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faCircleUser} className="text-muted" />
                <Select.Value>
                  {(v) => (v && v !== ALL ? v : "Select assigned broker")}
                </Select.Value>
              </span>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={ALL}>All Assignees</Select.Item>
              {assignees.map((a) => (
                <Select.Item key={a} value={a}>
                  {a}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      ),
    },
    {
      key: "stages",
      visible: show.side || show.relationship || show.dealStage,
      node: (
        <div className="d-flex flex-column gap-4">
          {show.side && (
            <div className="d-flex flex-column gap-2">
              <GroupHeading title="Side" />
              <div className="contact-filters__grid">
                {DEAL_SIDES.map((s) => (
                  <CheckRow
                    key={s}
                    label={SIDE_DISPLAY[s].label}
                    checked={filters.side.has(s)}
                    onToggle={() =>
                      set({ side: toggled<DealSide>(filters.side, s) })
                    }
                  />
                ))}
              </div>
            </div>
          )}
          {show.relationship && (
            <div className="d-flex flex-column gap-2">
              <GroupHeading title="Contact Stage" />
              <div className="contact-filters__grid">
                {RELATIONSHIP_STAGES.map((s) => (
                  <CheckRow
                    key={s}
                    label={RELATIONSHIP_DISPLAY[s].label}
                    checked={filters.relationship.has(s)}
                    onToggle={() =>
                      set({
                        relationship: toggled<RelationshipStage>(
                          filters.relationship,
                          s,
                        ),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}
          {show.dealStage && (
            <div className="d-flex flex-column gap-2">
              <GroupHeading title="Deal Stage" />
              <div className="contact-filters__grid">
                {CONTACT_DEAL_STAGES.map((s) => (
                  <CheckRow
                    key={s}
                    label={DEAL_STAGE_DISPLAY[s].label}
                    checked={filters.dealStage.has(s)}
                    onToggle={() =>
                      set({
                        dealStage: toggled<ContactDealStage>(
                          filters.dealStage,
                          s,
                        ),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "lastActivity",
      visible: show.lastActivity,
      node: (
        <div className="d-flex flex-column gap-2">
          <GroupHeading title="Last Activity" />
          <RadioGroup
            value={filters.lastActivity}
            onValueChange={(v) =>
              set({ lastActivity: v as ContactFilterState["lastActivity"] })
            }
            className="d-flex flex-column gap-1"
          >
            {LAST_ACTIVITY_OPTIONS.map((o) => (
              <label
                key={o.key}
                className="contact-filters__row d-flex align-items-center gap-2 mb-0 px-2 py-1 rounded-3"
              >
                <RadioGroup.Item value={o.key} />
                <span>{o.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      ),
    },
    {
      key: "openTasks",
      visible: show.openTasks,
      node: (
        <div className="d-flex flex-column gap-2">
          <GroupHeading title="Open Tasks" />
          <RadioGroup
            value={filters.openTasks}
            onValueChange={(v) =>
              set({ openTasks: v as ContactFilterState["openTasks"] })
            }
            className="d-flex flex-column gap-1"
          >
            {OPEN_TASKS_OPTIONS.map((o) => (
              <label
                key={o.key}
                className="contact-filters__row d-flex align-items-center gap-2 mb-0 px-2 py-1 rounded-3"
              >
                <RadioGroup.Item value={o.key} />
                <span>{o.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      ),
    },
    {
      key: "listingInquiries",
      visible: show.listingInquiries,
      node: (
        <div className="d-flex flex-column gap-2">
          <GroupHeading
            title="Listing Inquiries"
            description="Filter to contacts who have inquired about your listings — any listing, or one in particular"
          />
          <RadioGroup
            value={filters.listingInquiries}
            onValueChange={(v) => {
              const mode = v as ContactFilterState["listingInquiries"];
              set({
                listingInquiries: mode,
                // The picked listing only means something in "listing" mode.
                inquiryListingId:
                  mode === "listing" ? filters.inquiryListingId : null,
              });
            }}
            className="d-flex flex-column gap-1"
          >
            {LISTING_INQUIRY_OPTIONS.map((o) => (
              <label
                key={o.key}
                className="contact-filters__row d-flex align-items-center gap-2 mb-0 px-2 py-1 rounded-3"
              >
                <RadioGroup.Item value={o.key} />
                <span>{o.label}</span>
              </label>
            ))}
          </RadioGroup>
          {filters.listingInquiries === "listing" && (
            <Combobox
              items={listingItems}
              value={
                filters.inquiryListingId
                  ? listingLabelById.get(filters.inquiryListingId) ?? null
                  : null
              }
              onValueChange={(v) =>
                set({
                  inquiryListingId: v
                    ? listingIdByLabel.get(v as string) ?? null
                    : null,
                })
              }
            >
              <Combobox.InputGroup>
                <InputGroup.Addon>
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </InputGroup.Addon>
                <Combobox.Input
                  placeholder="Search listings"
                  showTrigger
                  showClear
                />
              </Combobox.InputGroup>
              <Combobox.Content>
                <Combobox.Empty className="text-muted p-2">
                  No matching listings
                </Combobox.Empty>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Content>
            </Combobox>
          )}
        </div>
      ),
    },
    {
      key: "propertyType",
      visible: show.propertyType,
      node: (
        <div className="d-flex flex-column gap-2">
          <GroupHeading
            title="Property Type"
            description="Select the type of property contacts own"
          />
          <div className="contact-filters__grid">
            {PROPERTY_TYPES.map((t) => (
              <CheckRow
                key={t}
                label={TYPE_LABELS[t]}
                checked={filters.propertyTypes.has(t)}
                onToggle={() =>
                  set({
                    propertyTypes: toggled<PropertyType>(
                      filters.propertyTypes,
                      t,
                    ),
                  })
                }
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "source",
      visible: show.source,
      node: (
        <div className="d-flex flex-column gap-2">
          <GroupHeading title="Source" />
          <div className="contact-filters__grid">
            {CONTACT_SOURCES.map((s) => (
              <CheckRow
                key={s}
                label={s}
                checked={filters.source.has(s)}
                onToggle={() =>
                  set({ source: toggled<ContactSource>(filters.source, s) })
                }
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "tags",
      visible: show.tags,
      node: (
        <div className="d-flex flex-column gap-2">
          <span className="fw-bold">Tags</span>
          <Combobox
            items={allTags}
            multiple
            value={tagValue}
            onValueChange={(v) => set({ tags: new Set((v as string[]) ?? []) })}
          >
            <Combobox.InputGroup>
              <InputGroup.Addon>
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </InputGroup.Addon>
              <Combobox.Input placeholder="Search tags" />
            </Combobox.InputGroup>
            <Combobox.Content>
              <Combobox.Empty className="text-muted">
                No matching tags
              </Combobox.Empty>
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Content>
          </Combobox>
          {tagValue.length > 0 && (
            <div className="d-flex flex-wrap gap-2">
              {tagValue.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  appearance="muted"
                  className="d-inline-flex align-items-center gap-1"
                >
                  {t}
                  <button
                    type="button"
                    className="btn btn-link p-0 border-0 d-inline-flex text-reset"
                    aria-label={`Remove ${t}`}
                    onClick={() => set({ tags: toggled(filters.tags, t) })}
                  >
                    <FontAwesomeIcon icon={faXmark} className="fs-small" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "doNotCall",
      visible: show.doNotCall,
      node: (
        <label className="d-flex align-items-center gap-2 mb-0">
          <Switch
            checked={filters.excludeDoNotCall}
            onCheckedChange={(c) => set({ excludeDoNotCall: c })}
            aria-label="Exclude contacts marked Do Not Call"
          />
          <span className="fw-semibold">
            Exclude contacts marked Do Not Call
          </span>
        </label>
      ),
    },
  ];

  const visibleSections = sections.filter((s) => s.visible);

  return (
    <div className="d-flex flex-column gap-4">
      {visibleSections.map((s, i) => (
        <Fragment key={s.key}>
          {s.node}
          {i < visibleSections.length - 1 && <Separator />}
        </Fragment>
      ))}
    </div>
  );
}
