import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faPencil,
  faCopy,
  faCommentSms,
} from "@fortawesome/pro-regular-svg-icons";
import {
  faFacebook,
  faLinkedin,
  faXTwitter,
} from "@fortawesome/free-brands-svg-icons";
import type { Listing } from "#/data/types";
import {
  getListingWebsiteSettings,
  VISIBILITY_OPTIONS,
  type WebsiteVisibility,
} from "#/data/listingWebsiteSettings";
import { Section } from "./listingWidgets";

const SHARE_ACTIONS = [
  { label: "Copy link", icon: faCopy, action: "copy" as const },
  { label: "Share via SMS", icon: faCommentSms, action: "sms" as const },
  { label: "Share to Facebook", icon: faFacebook, action: "facebook" as const },
  { label: "Share to LinkedIn", icon: faLinkedin, action: "linkedin" as const },
  { label: "Share to X", icon: faXTwitter, action: "x" as const },
];

/** Site status + settings section for the Website tab. */
export function WebsiteSiteSettings({ listing }: { listing: Listing }) {
  const settings = getListingWebsiteSettings(listing);
  const [visibility, setVisibility] = useState<WebsiteVisibility>(
    settings.visibility,
  );
  const [metaTitle, setMetaTitle] = useState(settings.metaTitle);
  const [metaDescription, setMetaDescription] = useState(
    settings.metaDescription,
  );

  const copyToClipboard = (text: string) => {
    void navigator.clipboard?.writeText(text);
  };

  return (
    <div className="d-flex flex-column gap-5">
      <Section title="Site Status">
        <div className="d-flex flex-column gap-3">
          <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <div className="d-flex flex-column gap-1">
              <div className="d-flex align-items-center gap-2">
                <span
                  className="rounded-circle"
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: settings.published
                      ? "var(--stage-active)"
                      : "var(--stage-inactive)",
                  }}
                />
                <span className="fw-semibold">
                  {settings.published ? "Published" : "Unpublished"}
                </span>
              </div>
              <div className="text-muted">{settings.templateName} template</div>
              <div className="text-muted" style={{ fontSize: 13 }}>
                Last updated {settings.lastUpdated}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              <Button variant="outline">
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                View Site
              </Button>
              <Button variant="primary">
                <FontAwesomeIcon icon={faPencil} />
                Edit Site
              </Button>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3 flex-wrap">
            <span className="text-muted text-truncate" style={{ minWidth: 0 }}>
              {settings.websiteUrl}
            </span>
            <div className="d-flex align-items-center gap-1 flex-shrink-0">
              {SHARE_ACTIONS.map((share) => (
                <Tooltip key={share.action}>
                  <Tooltip.Trigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={share.label}
                        onClick={
                          share.action === "copy"
                            ? () => copyToClipboard(settings.websiteUrl)
                            : undefined
                        }
                      >
                        <FontAwesomeIcon icon={share.icon} />
                      </Button>
                    }
                  />
                  <Tooltip.Content side="top">{share.label}</Tooltip.Content>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Settings">
        <div className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>Website URL</Field.Label>
            <InputGroup>
              <Input readOnly value={settings.websiteUrl} />
              <InputGroup.Addon>
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Copy website URL"
                        onClick={() => copyToClipboard(settings.websiteUrl)}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </Button>
                    }
                  />
                  <Tooltip.Content side="top">Copy link</Tooltip.Content>
                </Tooltip>
              </InputGroup.Addon>
            </InputGroup>
          </Field>

          <Field>
            <Field.Label>Visibility Options</Field.Label>
            <Select
              value={visibility}
              onValueChange={(v) => v && setVisibility(v as WebsiteVisibility)}
            >
              <Select.Trigger className="w-auto" style={{ minWidth: 220 }}>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {VISIBILITY_OPTIONS.map((opt) => (
                  <Select.Item key={opt} value={opt}>
                    {opt}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          <Field>
            <Field.Label>Meta Title</Field.Label>
            <Input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
            />
          </Field>

          <Field>
            <Field.Label>Meta Description</Field.Label>
            <Textarea
              rows={3}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}
