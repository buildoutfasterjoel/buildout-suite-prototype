import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import {
  COMPANY_STYLES,
  FONT_OPTIONS,
  type CompanyStyles,
} from "#/data/companySettings";
import { notify } from "#/lib/notify";
import { ManageCompanyNotice } from "#/components/settings/users/ManageCompanyNotice";
import { useCan } from "#/components/settings/users/useViewer";
import {
  SettingsCol,
  SettingsRow,
  SettingsSection,
} from "./settingsWidgets";

const BRAND_COLORS = [
  { key: "primaryColor", label: "Primary" },
  { key: "secondaryColor", label: "Secondary" },
  { key: "accentColor", label: "Accent" },
] as const satisfies readonly { key: keyof CompanyStyles; label: string }[];

const ACCENT_OPTIONS = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "accent", label: "Accent" },
] as const;

/** Serif choices should fall back to a serif, not to the browser default. */
const SERIF_FONTS = new Set(["Source Serif Pro", "Playfair Display"]);

/**
 * The prototype doesn't load webfonts for every option, so the preview needs a
 * fallback in the same family — otherwise picking an unavailable sans lands on
 * the browser's default serif and reads as a bug.
 */
function fontStack(font: string): string {
  return `"${font}", ${SERIF_FONTS.has(font) ? "Georgia, serif" : "system-ui, sans-serif"}`;
}

/**
 * The Styles tab of Company settings — the brand palette and type stack applied
 * to generated marketing documents and listing websites. A live swatch preview
 * sits beside the fields so a color change is visible without exporting a doc.
 */
export function CompanyStylesForm() {
  const canManage = useCan("manage-company");
  const [styles, setStyles] = useState<CompanyStyles>(COMPANY_STYLES);

  const set = <K extends keyof CompanyStyles>(
    key: K,
    value: CompanyStyles[K],
  ) => setStyles((prev) => ({ ...prev, [key]: value }));

  const accentColor =
    styles.documentAccent === "primary"
      ? styles.primaryColor
      : styles.documentAccent === "secondary"
        ? styles.secondaryColor
        : styles.accentColor;

  return (
    <div className="d-flex flex-column">
      <SettingsSection
        title="Brand Colors"
        description="Used for headers, accents, and call-to-action blocks on company documents."
      >
        <SettingsRow>
          {BRAND_COLORS.map((color) => (
            <div className="col-md-4" key={color.key}>
              <Field>
                <Field.Label>{color.label}</Field.Label>
                <InputGroup>
                  <InputGroup.Addon>
                    <span
                      className="rounded-1 d-inline-block border"
                      style={{
                        width: 16,
                        height: 16,
                        backgroundColor: styles[color.key] as string,
                      }}
                    />
                  </InputGroup.Addon>
                  <Input
                    value={styles[color.key] as string}
                    onChange={(e) => set(color.key, e.target.value)}
                  />
                </InputGroup>
              </Field>
            </div>
          ))}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Typography"
        description="The type stack documents fall back to when a template doesn't override it."
      >
        <SettingsRow>
          <SettingsCol>
            <Field>
              <Field.Label>Heading Font</Field.Label>
              <Select
                value={styles.headingFont}
                onValueChange={(v) => v && set("headingFont", v as string)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {FONT_OPTIONS.map((font) => (
                    <Select.Item key={font} value={font}>
                      {font}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Body Font</Field.Label>
              <Select
                value={styles.bodyFont}
                onValueChange={(v) => v && set("bodyFont", v as string)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {FONT_OPTIONS.map((font) => (
                    <Select.Item key={font} value={font}>
                      {font}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          </SettingsCol>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Document Accent" divider={false}>
        <div className="row g-4 align-items-start">
          <div className="col-md-6">
            <RadioGroup
              value={styles.documentAccent}
              onValueChange={(v) =>
                set("documentAccent", v as CompanyStyles["documentAccent"])
              }
              className="d-flex flex-column gap-2"
            >
              {ACCENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="d-flex align-items-center gap-2"
                >
                  <RadioGroup.Item value={option.value} />
                  <span>{option.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Preview — the accent choice and type stack applied to a doc header. */}
          <div className="col-md-6">
            <div className="border rounded overflow-hidden">
              <div
                className="p-3"
                style={{ backgroundColor: accentColor, color: "#fff" }}
              >
                <div
                  className="fw-bold fs-5"
                  style={{ fontFamily: fontStack(styles.headingFont) }}
                >
                  Offering Memorandum
                </div>
                <div
                  className="opacity-75"
                  style={{ fontFamily: fontStack(styles.bodyFont) }}
                >
                  1200 W Randolph St, Chicago, IL
                </div>
              </div>
              <div
                className="p-3 text-muted"
                style={{ fontFamily: fontStack(styles.bodyFont) }}
              >
                Body copy renders in {styles.bodyFont}; headings render in{" "}
                {styles.headingFont}.
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {canManage ? (
        <div className="d-flex justify-content-end mt-5">
          <Button
            variant="primary"
            onClick={() => notify({ title: "Brand styles saved" })}
          >
            Save Changes
          </Button>
        </div>
      ) : (
        <div className="mt-5">
          <ManageCompanyNotice what="change brand styles" />
        </div>
      )}
    </div>
  );
}
