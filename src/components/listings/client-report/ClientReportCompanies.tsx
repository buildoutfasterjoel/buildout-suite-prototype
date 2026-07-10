import { List } from "@buildoutinc/blueprint-react/ui/List";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import type { ClientReportLead } from "#/data/listingClientReport";
import { Section } from "../listingWidgets";

/** Companies engaged with this listing, grouped from the leads roster below. */
export function ClientReportCompanies({ leads }: { leads: ClientReportLead[] }) {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    counts.set(lead.company, (counts.get(lead.company) ?? 0) + 1);
  }
  const companies = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Section title="Companies">
      <List>
        {companies.map(([company, count]) => (
          <List.Item key={company}>
            <List.ItemContent>
              <List.ItemTitle>{company}</List.ItemTitle>
            </List.ItemContent>
            <List.ItemActions>
              <Badge variant="secondary" appearance="muted">
                {count} {count === 1 ? "lead" : "leads"}
              </Badge>
            </List.ItemActions>
          </List.Item>
        ))}
      </List>
    </Section>
  );
}
