import { useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faCirclePlus } from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { getEmails } from "#/data/emails";
import { EmailsTable } from "#/components/email/EmailsTable";
import { ListingPageHeader } from "./ListingPageHeader";

/** Email subpage: all campaigns attached to this listing (matched by property type). */
export function ListingEmail({ listing }: { listing: Listing }) {
  const [search, setSearch] = useState("");

  const campaigns = useMemo(
    () =>
      getEmails().filter((e) => e.type === listing.propertyType && !e.archived),
    [listing.propertyType],
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
          <Button variant="primary">
            <FontAwesomeIcon icon={faCirclePlus} />
            New Email
          </Button>
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
