import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTableCells,
  faSackDollar,
  faFileContract,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { getGridsData } from "#/data/grids";
import { formatDate, formatMoney } from "#/components/deals/dealDisplay";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import type { Grid, LeaseComp, SaleComp } from "./types";

type GridsTab = "grids" | "sale" | "lease";

const NEW_ACTION_LABEL: Record<GridsTab, string> = {
  grids: "New Grid",
  sale: "New Sale Comp",
  lease: "New Lease Comp",
};

function GridsTable({ grids }: { grids: Grid[] }) {
  if (grids.length === 0) {
    return (
      <Empty className="py-6">
        <Empty.Media>
          <FontAwesomeIcon icon={faTableCells} aria-label="No grids" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>No grids yet</Empty.Title>
          Grids help you compare and analyze properties side by side.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary" size="sm">
            <FontAwesomeIcon icon={faPlus} />
            New Grid
          </Button>
        </Empty.Actions>
      </Empty>
    );
  }

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Name</Table.Head>
          <Table.Head>Type</Table.Head>
          <Table.Head className="text-end">Comps</Table.Head>
          <Table.Head>Created By</Table.Head>
          <Table.Head>Updated Date</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {grids.map((g) => (
          <Table.Row key={g.id}>
            <Table.Cell>{g.name}</Table.Cell>
            <Table.Cell>{g.type}</Table.Cell>
            <Table.Cell className="text-end">{g.compCount}</Table.Cell>
            <Table.Cell>{g.createdBy}</Table.Cell>
            <Table.Cell>{formatDate(g.updatedDate)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function SaleCompsTable({ comps }: { comps: SaleComp[] }) {
  if (comps.length === 0) {
    return (
      <Empty className="py-6">
        <Empty.Media>
          <FontAwesomeIcon icon={faSackDollar} aria-label="No sale comps" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>No sale comps yet</Empty.Title>
          Add comparable sales to support your pricing analysis.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary" size="sm">
            <FontAwesomeIcon icon={faPlus} />
            New Sale Comp
          </Button>
        </Empty.Actions>
      </Empty>
    );
  }

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Property</Table.Head>
          <Table.Head>Address</Table.Head>
          <Table.Head>Sale Date</Table.Head>
          <Table.Head>Buyer</Table.Head>
          <Table.Head>Seller</Table.Head>
          <Table.Head className="text-end">Price/SF</Table.Head>
          <Table.Head className="text-end">Cap Rate</Table.Head>
          <Table.Head className="text-end">Sale Price</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {comps.map((c) => (
          <Table.Row key={c.id}>
            <Table.Cell>{c.propertyName}</Table.Cell>
            <Table.Cell>{c.address}</Table.Cell>
            <Table.Cell>{formatDate(c.saleDate)}</Table.Cell>
            <Table.Cell>{c.buyer}</Table.Cell>
            <Table.Cell>{c.seller}</Table.Cell>
            <Table.Cell className="text-end">{formatMoney(c.pricePerSf)}</Table.Cell>
            <Table.Cell className="text-end">{c.capRate}%</Table.Cell>
            <Table.Cell className="text-end">{formatMoney(c.salePrice)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function LeaseCompsTable({ comps }: { comps: LeaseComp[] }) {
  if (comps.length === 0) {
    return (
      <Empty className="py-6">
        <Empty.Media>
          <FontAwesomeIcon icon={faFileContract} aria-label="No lease comps" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>No lease comps yet</Empty.Title>
          Add comparable leases to support your pricing analysis.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary" size="sm">
            <FontAwesomeIcon icon={faPlus} />
            New Lease Comp
          </Button>
        </Empty.Actions>
      </Empty>
    );
  }

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Property</Table.Head>
          <Table.Head>Address</Table.Head>
          <Table.Head>Lease Date</Table.Head>
          <Table.Head>Tenant</Table.Head>
          <Table.Head>Lease Type</Table.Head>
          <Table.Head className="text-end">Term (mo)</Table.Head>
          <Table.Head className="text-end">SF</Table.Head>
          <Table.Head className="text-end">Rent/SF</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {comps.map((c) => (
          <Table.Row key={c.id}>
            <Table.Cell>{c.propertyName}</Table.Cell>
            <Table.Cell>{c.address}</Table.Cell>
            <Table.Cell>{formatDate(c.leaseDate)}</Table.Cell>
            <Table.Cell>{c.tenantName}</Table.Cell>
            <Table.Cell>{c.leaseType}</Table.Cell>
            <Table.Cell className="text-end">{c.termMonths}</Table.Cell>
            <Table.Cell className="text-end">{c.sf.toLocaleString()}</Table.Cell>
            <Table.Cell className="text-end">{formatMoney(c.rentPsf)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

/** Grids page: saved comparison grids plus sale/lease comps, each in its own tab. */
export function GridsPage({ listing }: { listing: Listing }) {
  const [tab, setTab] = useState<GridsTab>("grids");
  const { grids, saleComps, leaseComps } = getGridsData(listing.id);

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader
        title="Grids"
        actions={
          <Button variant="primary">
            <FontAwesomeIcon icon={faPlus} />
            {NEW_ACTION_LABEL[tab]}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as GridsTab)}>
        <Tabs.List>
          <Tabs.Tab value="grids" icon={<FontAwesomeIcon icon={faTableCells} />}>
            Grids
          </Tabs.Tab>
          <Tabs.Tab value="sale" icon={<FontAwesomeIcon icon={faSackDollar} />}>
            Sale Comps
          </Tabs.Tab>
          <Tabs.Tab value="lease" icon={<FontAwesomeIcon icon={faFileContract} />}>
            Lease Comps
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Content>
          <Tabs.Panel value="grids" className="pt-4">
            <GridsTable grids={grids} />
          </Tabs.Panel>
          <Tabs.Panel value="sale" className="pt-4">
            <SaleCompsTable comps={saleComps} />
          </Tabs.Panel>
          <Tabs.Panel value="lease" className="pt-4">
            <LeaseCompsTable comps={leaseComps} />
          </Tabs.Panel>
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
