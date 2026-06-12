---
name: icons
description: Select, import, and render FontAwesome Pro icons correctly in this prototype. Covers weight selection rules (regular by default, duotone for Alert and Banner), import patterns, usage with Blueprint components, a curated reference of common UI icons, and how to find the right icon for any use case.
---

This skill governs all icon usage in this prototype. Installed packages are `pro-regular-svg-icons`, `pro-solid-svg-icons`, and `pro-duotone-svg-icons`. There is no `pro-light-svg-icons` — do not import from it.

## 1. Weight selection rules

| Situation | Package |
|---|---|
| **Everything else** (default) | `@fortawesome/pro-regular-svg-icons` |
| **Alert component** | `@fortawesome/pro-duotone-svg-icons` |
| **Banner component** | `@fortawesome/pro-duotone-svg-icons` |
| Solid weight needed (deliberate emphasis, filled state) | `@fortawesome/pro-solid-svg-icons` — discuss with user first |

Never use solid as a default. If you're unsure, use regular.

## 2. Import and render

```tsx
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPencil, faTrash } from '@fortawesome/pro-regular-svg-icons'

<FontAwesomeIcon icon={faPlus} />
```

The icon object carries its own style prefix (`far` for regular, `fas` for solid, `fad` for duotone) — importing from the correct package is all that's needed. No library registration step required.

When mixing weights in the same file, alias the conflicting name at the import:

```tsx
import { faCircleInfo as faCircleInfoRegular } from '@fortawesome/pro-regular-svg-icons'
import { faCircleInfo } from '@fortawesome/pro-duotone-svg-icons'
```

## 3. Alert and Banner — use duotone

Both components take the icon as a JSX child. Swap to `pro-duotone-svg-icons` and pass `withIcon` on Alert:

```tsx
import { Alert, AlertTitle } from '@buildoutinc/blueprint-react/ui/Alert'
import { Banner, BannerContent, BannerActions } from '@buildoutinc/blueprint-react/ui/Banner'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleInfo,
  faCircleCheck,
  faTriangleExclamation,
  faCircleXmark,
} from '@fortawesome/pro-duotone-svg-icons'

// Alert — add withIcon so the component reserves left padding
<Alert severity="info" withIcon>
  <FontAwesomeIcon icon={faCircleInfo} />
  <AlertTitle>Heads up</AlertTitle>
  Something worth knowing.
</Alert>

<Alert severity="success" withIcon>
  <FontAwesomeIcon icon={faCircleCheck} />
  Saved successfully.
</Alert>

<Alert severity="warning" withIcon>
  <FontAwesomeIcon icon={faTriangleExclamation} />
  Review before continuing.
</Alert>

<Alert severity="destructive" withIcon>
  <FontAwesomeIcon icon={faCircleXmark} />
  Something went wrong.
</Alert>

// Banner — icon goes as first child inside BannerContent
<Banner variant="info">
  <BannerContent>
    <FontAwesomeIcon icon={faCircleInfo} />
    This listing has been updated.
  </BannerContent>
  <BannerActions>
    <Button variant="ghost" size="sm">Dismiss</Button>
  </BannerActions>
</Banner>
```

## 4. Sizing

The `FontAwesomeIcon` component inherits `font-size` from its parent by default. Control size with Bootstrap utilities or the `size` prop:

```tsx
// Bootstrap font-size utilities (preferred — stays on the type scale)
<FontAwesomeIcon icon={faPlus} className="fs-5" />   // ~1.25rem
<FontAwesomeIcon icon={faPlus} className="fs-6" />   // ~1rem (body size)

// FA size prop (fixed scale, independent of Bootstrap)
<FontAwesomeIcon icon={faSpinner} size="sm" />   // 0.875em
<FontAwesomeIcon icon={faSpinner} size="lg" />   // 1.25em
<FontAwesomeIcon icon={faSpinner} size="2x" />   // 2em

// Inline — for one-offs
<FontAwesomeIcon icon={faBuilding} style={{ fontSize: '2rem' }} />
```

For icon buttons (`Button size="icon"` or `size="icon-sm"`), let the button control the size — do not add a size prop to the icon.

## 5. Common icon reference

Use this as a first-pass lookup before searching the FontAwesome site. All names confirmed in the installed packages.

### Navigation & chrome
| Icon | Name |
|---|---|
| Home | `faHouse` |
| Back / forward | `faArrowLeft` · `faArrowRight` |
| Chevrons (collapse, pagination) | `faChevronLeft` · `faChevronRight` · `faChevronUp` · `faChevronDown` |
| Hamburger menu | `faBars` |
| Close / dismiss | `faXmark` |
| More options (horizontal) | `faEllipsis` |
| Drag handle | `faGrip` |

### CRUD & actions
| Icon | Name |
|---|---|
| Create / add | `faPlus` |
| Edit | `faPencil` |
| Delete | `faTrash` |
| Save | `faFloppyDisk` |
| Duplicate | `faCopy` |
| Import / export | `faFileImport` · `faFileExport` |
| Download / upload | `faDownload` · `faUpload` |
| Refresh | `faRotate` |
| Link | `faLink` |

### Search & filter
| Icon | Name |
|---|---|
| Search | `faMagnifyingGlass` |
| Filter | `faSliders` |
| Sort ascending / descending | `faSortUp` · `faSortDown` |
| Sort list | `faBarsSort` |
| Tag / label | `faTag` |

### Status & feedback (regular — general use)
| Icon | Name |
|---|---|
| Success / confirm | `faCircleCheck` |
| Info | `faCircleInfo` |
| Warning | `faTriangleExclamation` |
| Error / destructive | `faCircleXmark` |
| Generic check | `faCheck` |
| Loading | `faSpinner` |

### Status & feedback (duotone — Alert and Banner only)
Same icon names as above, imported from `@fortawesome/pro-duotone-svg-icons`.

### Visibility & access
| Icon | Name |
|---|---|
| Show / hide | `faEye` · `faEyeSlash` |
| Lock / unlock | `faLock` · `faUnlock` |

### CRE & product-specific
| Icon | Name |
|---|---|
| Property / building | `faBuilding` |
| Institution | `faBuildingColumns` |
| Deal / agreement | `faHandshake` |
| Location pin | `faMapPin` |
| Map | `faMapLocation` |
| Financial / price | `faDollarSign` |
| Date | `faCalendar` |
| Time | `faClock` |
| Chart / metrics | `faChartBar` |
| Contact / person | `faUser` |
| Team / group | `faUsers` |
| Email | `faEnvelope` |
| Phone | `faPhone` |

## 6. Finding icons not in this list

Search at **https://fontawesome.com/search?o=r&m=pro** — filter by "Pro" to see only available icons. The name shown in the UI converts to camelCase with an `fa` prefix:

- `house-chimney` → `faHouseChimney`
- `circle-check` → `faCircleCheck`
- `magnifying-glass` → `faMagnifyingGlass`

After finding the icon, import from the appropriate weight package per section 1.
