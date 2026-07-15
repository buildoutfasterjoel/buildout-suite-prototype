import { useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faCirclePlus } from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { EmailsTable } from "#/components/email/EmailsTable";
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
