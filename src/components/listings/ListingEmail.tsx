import { useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faCirclePlus,
  faPenNib,
  faSparkles,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { generateEmail } from "#/ai/generate";
import { propertySummary } from "#/ai/tools";
import { createEmailDraft } from "#/data/actions";
import { EmailsTable } from "#/components/email/EmailsTable";
import { EmailDraftCard, type EmailDraftCardData } from "#/components/ai/EmailDraftCard";
import { ListingPageHeader } from "./ListingPageHeader";

/** Email subpage: all campaigns attached to this listing (matched by property type). */
export function ListingEmail({ listing }: { listing: Listing }) {
  const [search, setSearch] = useState("");

  const emailsMap = useDataStore((s) => s.emails);
  const property = getProperty(listing.propertyId);
  const campaigns = useMemo(
    () =>
      [...emailsMap.values()].filter(
        (e) => e.type === property?.propertyType && !e.archived,
      ),
    [emailsMap, property?.propertyType],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((e) =>
      `${e.campaign} ${e.subject}`.toLowerCase().includes(q),
    );
  }, [campaigns, search]);

  return (
    <div className="d-flex flex-column gap-3 p-4" style={{ minWidth: 0 }}>
      <ListingPageHeader
        title="Email"
        actions={
          <div className="d-flex align-items-center gap-2">
            <DraftWithAiButton listing={listing} />
            <Button variant="primary">
              <FontAwesomeIcon icon={faCirclePlus} />
              New Email
            </Button>
          </div>
        }
      />

      <div style={{ minWidth: 240, maxWidth: 320 }}>
        <InputGroup>
          <InputGroup.Addon>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </InputGroup.Addon>
          <Input
            type="search"
            placeholder="Search campaigns"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <EmailsTable emails={filtered} filtersActive={search.trim() !== ""} />
    </div>
  );
}

/**
 * "Draft with AI" — generates an outreach email for this listing's property
 * (§3.2). Opens a small dialog: enter the intent, generate, review the draft
 * inline, then hop to the full Email module to send it.
 */
function DraftWithAiButton({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<EmailDraftCardData | null>(null);

  const reset = () => {
    setIntent("");
    setDraft(null);
    setLoading(false);
  };

  const generate = async () => {
    setLoading(true);
    try {
      const property = getProperty(listing.propertyId);
      const propPayload = property
        ? { name: listing.name, ...propertySummary(property) }
        : { name: listing.name };
      const spec = await generateEmail({
        data: { property: propPayload, intent: intent.trim() || "Reach out about this property", recipients: [] },
      });
      const { email } = createEmailDraft({ subject: spec.subject });
      setDraft({ ...spec, id: email.id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Dialog.Trigger render={<Button variant="outline" />}>
        <FontAwesomeIcon icon={faPenNib} />
        Draft with AI
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Draft an outreach email</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body className="d-flex flex-column gap-3">
            {!draft ? (
              <Field>
                <Field.Label>What's this email about?</Field.Label>
                <Input
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="e.g. price reduction, introduce myself as the listing broker"
                  autoFocus
                />
              </Field>
            ) : (
              <EmailDraftCard draft={draft} />
            )}
          </Dialog.Body>
          <Dialog.Footer>
            {!draft ? (
              <>
                <Dialog.Cancel variant="outline">Cancel</Dialog.Cancel>
                <Button variant="primary" onClick={generate} disabled={loading}>
                  <FontAwesomeIcon icon={faSparkles} />
                  {loading ? "Drafting…" : "Generate"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={reset}>
                  Draft another
                </Button>
                <Dialog.Cancel variant="primary">Done</Dialog.Cancel>
              </>
            )}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
