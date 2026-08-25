import { useLocation } from "@tanstack/react-router";
import { Navbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// The AI assistant launcher uses the solid sparkle (per Figma).
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";
import BuildoutIcon from "#/features/assets/buildout-icon";
import BuildoutWordmark from "#/features/assets/buildout-wordmark";
import { useAssistant } from "#/ai/useAssistant";
import { AccountMenu } from "./AccountMenu";
import {
  NewMenu,
  NotificationsLink,
  OmniBarTrigger,
  TasksLink,
  useNavClick,
} from "./navbarParts";
import {
  NAV_SECTIONS,
  isNavGroup,
  isSectionActive,
  type NavGroup,
  type NavLeaf,
  type NavSection,
} from "./navSections";

/**
 * The classic global nav: one full-width dark bar carrying everything — brand,
 * sections, omnibar, and the right-hand action cluster.
 *
 * Its counterpart is `AppTopBar` + `AppSideNav`; which one renders is decided by
 * `useNavMode` and switched from the account menu.
 */
export function GlobalNavbar() {
  const { pathname } = useLocation();

  const handleNavClick = useNavClick();
  const assistantOpen = useAssistant((s) => s.open);
  const toggleAssistant = useAssistant((s) => s.toggle);

  /** A leaf section: the nav item itself is the link. */
  function renderLeaf(section: NavLeaf) {
    return (
      <Navbar.Item key={section.label}>
        <Navbar.ItemLink
          isActive={isSectionActive(section, pathname)}
          render={
            <a
              href={section.href}
              onClick={(e) => handleNavClick(e, section.href)}
            />
          }
        >
          <Navbar.ItemLinkIcon>
            <FontAwesomeIcon icon={section.icon} />
          </Navbar.ItemLinkIcon>
          <Navbar.ItemLinkLabel>{section.label}</Navbar.ItemLinkLabel>
        </Navbar.ItemLink>
      </Navbar.Item>
    );
  }

  /**
   * A group section: the label opens a dropdown and the children carry the
   * destinations, so the label itself doesn't navigate. GroupTrigger renders a
   * `nav-link` and appends its own caret — the rule that hides that caret is
   * scoped to the New and Account triggers, so a nav dropdown keeps it. It has
   * no `isActive` prop, hence the bare `active` class: it's the same `nav-link`
   * inside `.navbar-collapse` that ItemLink is, so it picks up the same
   * white/bold/purple-icon treatment.
   */
  function renderGroup(section: NavGroup) {
    return (
      <Navbar.Group key={section.label}>
        <Navbar.GroupTrigger
          className={isSectionActive(section, pathname) ? "active" : undefined}
        >
          <Navbar.ItemLinkIcon>
            <FontAwesomeIcon icon={section.icon} />
          </Navbar.ItemLinkIcon>
          <Navbar.ItemLinkLabel>{section.label}</Navbar.ItemLinkLabel>
        </Navbar.GroupTrigger>
        <Navbar.GroupMenu>
          {section.items.map((item) => (
            <Navbar.GroupMenuItem
              key={item.href}
              render={
                <a
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                />
              }
            >
              {item.label}
            </Navbar.GroupMenuItem>
          ))}
        </Navbar.GroupMenu>
      </Navbar.Group>
    );
  }

  function renderSection(section: NavSection) {
    return isNavGroup(section) ? renderGroup(section) : renderLeaf(section);
  }

  return (
    <Navbar expand="lg" className="global-navbar">
      <Navbar.Brand
        href="/suite"
        onClick={(e) => handleNavClick(e, "/suite")}
        aria-label="Buildout"
        className="d-inline-flex align-items-center gap-2"
      >
        <BuildoutIcon style={{ height: 24, width: 24 }} />
        <BuildoutWordmark style={{ height: 24 }} />
      </Navbar.Brand>

      <Navbar.Toggler />

      <Navbar.Content className="flex-nowrap">
        <Navbar.Nav>
          {NAV_SECTIONS.map((section) => renderSection(section))}

          <Navbar.Item className="d-flex align-items-center ms-2">
            <OmniBarTrigger />
          </Navbar.Item>
        </Navbar.Nav>
      </Navbar.Content>

      <Navbar.Footer className="flex-grow-0 flex-shrink-0 d-flex align-items-center">
        <Navbar.Nav>
          <NewMenu />
          <TasksLink />
          <NotificationsLink />

          {/* AI Assistant launcher — a filled purple-gradient circle. */}
          <Navbar.Item>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Navbar.ItemLink
                    aria-label="Assistant"
                    className="navbar-ai-btn"
                    isActive={assistantOpen}
                    render={<a href="#" />}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleAssistant();
                    }}
                  >
                    <Navbar.ItemLinkIcon>
                      <FontAwesomeIcon icon={faSparkles} />
                    </Navbar.ItemLinkIcon>
                  </Navbar.ItemLink>
                }
              />
              <Tooltip.Content>Assistant</Tooltip.Content>
            </Tooltip>
          </Navbar.Item>
        </Navbar.Nav>
        <AccountMenu />
      </Navbar.Footer>
    </Navbar>
  );
}
