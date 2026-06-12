---
name: new-page
description: Scaffold a new prototype page in this TanStack Start project. Use when a user wants to add a new screen, route, or feature to their prototype. Guides route creation, Blueprint layout selection, component scaffolding, and design direction — so the result looks intentional and on-brand from the start.
---

This skill scaffolds new prototype pages using TanStack Router's file-based routing and Buildout's Blueprint design system. Every page created through this skill should feel like a deliberate design decision, not a generic Bootstrap layout.

## When to use

Trigger this skill when the user is:

- Adding a new screen, page, or feature to their prototype
- Asking how to create a new route
- Wanting to build out a specific UI pattern (list, detail, form, dashboard, landing)

## Step 1: Gather context before writing any code

Ask the user these questions before touching any files. Do not scaffold anything until you understand the answers:

1. **What is this page for?** — Describe the feature or screen in one sentence (e.g., "a property listing index", "a deal pipeline view", "a contact profile page").
2. **What type of content does it display?** — Pick the closest match: *list/table*, *detail/profile*, *form/create-edit*, *dashboard/overview*, or *landing/marketing*.
3. **Does it need persistent navigation?** — Should the page have a top Navbar, a left Sidebar, both, or neither?

If the user has already answered any of these in their request, do not ask again — proceed with what you know.

## Step 2: Create the route file

Routes are files in `src/routes/`. The file path determines the URL:

| File path | URL |
|---|---|
| `src/routes/listings.tsx` | `/listings` |
| `src/routes/listings/$id.tsx` | `/listings/:id` (dynamic) |
| `src/routes/listings/index.tsx` | `/listings` (index within a directory) |
| `src/routes/_layout.tsx` | Pathless layout wrapper (no URL segment) |

The **route tree is auto-generated** — just create the file. Never edit `src/routeTree.gen.ts`.

Every route file must export a `Route` constant:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/your-path')({ component: YourPage })

function YourPage() {
  return (
    // page content
  )
}
```

Use path aliases for local imports — both `#/` and `@/` resolve to `src/`:

```tsx
import { SomeComponent } from '#/components/some-component'
```

## Step 3: Pick a layout pattern

Choose the layout that fits the page's purpose. Fetch the full component API from the docs if you need precise props:
`https://buildoutinc.github.io/blueprint/llm/docs/components/<kebab-name>.mdx`

### Full-width centered (landing, error, empty states)

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/landing')({ component: Landing })

function Landing() {
  return (
    <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center px-4">
      {/* content */}
    </div>
  )
}
```

### Navbar + content (standard app pages)

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { Navbar, NavbarBrand, NavbarNav, NavbarItem } from '@buildoutinc/blueprint-react/ui/Navbar'

export const Route = createFileRoute('/listings')({ component: Listings })

function Listings() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar>
        <NavbarBrand>Prototype</NavbarBrand>
        <NavbarNav>
          <NavbarItem active>Listings</NavbarItem>
          <NavbarItem>Contacts</NavbarItem>
        </NavbarNav>
      </Navbar>
      <main className="container py-5">
        {/* page content */}
      </main>
    </div>
  )
}
```

### Sidebar + content (data-heavy, multi-section apps)

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { Sidebar, SidebarNav, SidebarNavItem } from '@buildoutinc/blueprint-react/ui/Sidebar'

export const Route = createFileRoute('/dashboard')({ component: Dashboard })

function Dashboard() {
  return (
    <div className="d-flex min-vh-100">
      <Sidebar>
        <SidebarNav>
          <SidebarNavItem active>Dashboard</SidebarNavItem>
          <SidebarNavItem>Deals</SidebarNavItem>
        </SidebarNav>
      </Sidebar>
      <main className="flex-grow-1 p-5">
        {/* page content */}
      </main>
    </div>
  )
}
```

## Step 4: Apply the right page pattern

Pick the pattern that matches the content type from Step 1.

### List / table page

```tsx
import { Card, CardHeader, CardTitle, CardBody } from '@buildoutinc/blueprint-react/ui/Card'
import { Button } from '@buildoutinc/blueprint-react/ui/Button'
import { Input } from '@buildoutinc/blueprint-react/ui/Input'
import { Table } from '@buildoutinc/blueprint-react/ui/Table'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faPlus } from '@fortawesome/pro-regular-svg-icons'

function ListingsPage() {
  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Listings</h1>
        <Button variant="primary">
          <FontAwesomeIcon icon={faPlus} />
          Add Listing
        </Button>
      </div>
      <Card>
        <CardHeader>
          <Input placeholder="Search…" />
        </CardHeader>
        <CardBody className="p-0">
          <Table>{/* rows */}</Table>
        </CardBody>
      </Card>
    </div>
  )
}
```

### Detail / profile page

```tsx
import { Card, CardHeader, CardTitle, CardBody } from '@buildoutinc/blueprint-react/ui/Card'
import { Button } from '@buildoutinc/blueprint-react/ui/Button'
import { Badge } from '@buildoutinc/blueprint-react/ui/Badge'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faPencil } from '@fortawesome/pro-regular-svg-icons'

function PropertyDetailPage() {
  return (
    <div className="container py-5">
      <Button variant="ghost" className="mb-4">
        <FontAwesomeIcon icon={faArrowLeft} />
        Back to Listings
      </Button>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1 className="h3 mb-1">123 Main Street</h1>
          <Badge variant="success">Active</Badge>
        </div>
        <Button variant="outline">
          <FontAwesomeIcon icon={faPencil} />
          Edit
        </Button>
      </div>
      <div className="row g-4">
        <div className="col-8">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardBody>{/* fields */}</CardBody>
          </Card>
        </div>
        <div className="col-4">
          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardBody>{/* timeline */}</CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

### Form / create-edit page

```tsx
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@buildoutinc/blueprint-react/ui/Card'
import { Field } from '@buildoutinc/blueprint-react/ui/Field'
import { Label } from '@buildoutinc/blueprint-react/ui/Label'
import { Input } from '@buildoutinc/blueprint-react/ui/Input'
import { Textarea } from '@buildoutinc/blueprint-react/ui/Textarea'
import { Button } from '@buildoutinc/blueprint-react/ui/Button'

function CreateListingPage() {
  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">New Listing</h1>
      <Card>
        <CardBody className="d-flex flex-column gap-4">
          <Field>
            <Label>Address</Label>
            <Input placeholder="123 Main Street" />
          </Field>
          <Field>
            <Label>Description</Label>
            <Textarea rows={4} placeholder="Property overview…" />
          </Field>
        </CardBody>
        <CardFooter className="d-flex justify-content-end gap-2">
          <Button variant="outline">Cancel</Button>
          <Button variant="primary">Create Listing</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
```

### Dashboard / overview page

```tsx
import { Card, CardHeader, CardTitle, CardBody } from '@buildoutinc/blueprint-react/ui/Card'
import { Badge } from '@buildoutinc/blueprint-react/ui/Badge'

function DashboardPage() {
  const stats = [
    { label: 'Active Listings', value: '142' },
    { label: 'Open Deals', value: '38' },
    { label: 'Contacts', value: '1,204' },
  ]

  return (
    <div className="container py-5">
      <h1 className="h3 mb-5">Dashboard</h1>
      <div className="row g-4 mb-5">
        {stats.map((s) => (
          <div key={s.label} className="col-4">
            <Card>
              <CardBody>
                <div className="text-muted small mb-1">{s.label}</div>
                <div className="h2 mb-0">{s.value}</div>
              </CardBody>
            </Card>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardBody>{/* activity list */}</CardBody>
      </Card>
    </div>
  )
}
```

## Step 5: Apply design direction

Before finalizing the scaffold, pick a direction and apply it. Name it — then make choices that commit to it. The same Blueprint components look completely different depending on how you use them.

- **Spacious / editorial** — generous padding, large type scale, asymmetric sections, deliberate negative space
- **Dense / data-heavy** — tight spacing, smaller type, efficient use of horizontal space, structured tables
- **Minimal / utilitarian** — strip decoration, lean on white space and typography alone, ghost buttons over filled ones
- **Rich / marketing** — layered backgrounds, varied card sizes, color application, prominent hero treatment

Avoid the generic default: equal-spaced cards, default heading sizes, a primary button at the bottom. Make at least one layout decision that isn't the obvious choice.

## Step 6: Icon rules

- **Default**: always import from `@fortawesome/pro-regular-svg-icons`
- **Alert and Banner components only**: use `@fortawesome/pro-duotone-svg-icons`
- **Solid, light, or other weights**: case-by-case — discuss with the user before using

```tsx
// Standard usage
import { faHouse, faSearch, faPlus } from '@fortawesome/pro-regular-svg-icons'

// Alert / Banner only
import { faCircleExclamation } from '@fortawesome/pro-duotone-svg-icons'
```

## Step 7: Add a card to the index

After creating the route file, open `src/routes/index.tsx` and add a card for this prototype. The index is the directory of all prototypes in the project — every new page must appear there.

Use `<Link>` from TanStack Router, not an `<a>` tag:

```tsx
import { Link } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardBody } from '@buildoutinc/blueprint-react/ui/Card'

<Link to="/your-prototype-path">
  <Card>
    <CardHeader><CardTitle>Prototype Name</CardTitle></CardHeader>
    <CardBody>Short description of what this prototype demonstrates.</CardBody>
  </Card>
</Link>
```

Do not add navigation chrome (Navbar, Sidebar) to the index or to individual prototype pages — the app layout will be handled separately.

## Step 8: Verify after scaffolding

After creating the files, confirm with the user:
1. The dev server (`bun --bun run dev`) should hot-reload and show the new route at `http://localhost:3000/<your-path>`
2. If the route doesn't appear, check that the file path matches the route string in `createFileRoute()`
3. `routeTree.gen.ts` updates automatically — no manual edit needed
