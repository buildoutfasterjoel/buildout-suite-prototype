import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/pro-regular-svg-icons";
import {
  faFacebook,
  faLinkedin,
  faXTwitter,
  faYoutube,
} from "@fortawesome/free-brands-svg-icons";
import {
  COMPANY_SETTINGS,
  SPECIALTY_OPTIONS,
  SUB_SPECIALTY_OPTIONS,
  type CompanySettings,
} from "#/data/companySettings";
import {
  GRANT_DEFAULT_LABELS,
  resolveCompanyDefault,
  type ContactAccessSettings,
  type GrantDefault,
} from "#/data/contactAccess";
import { notify } from "#/lib/notify";
import { ManageCompanyNotice } from "#/components/settings/users/ManageCompanyNotice";
import { useCan } from "#/components/settings/users/useViewer";
import { useContactAccessSettings } from "#/components/settings/useContactAccessSettings";
import {
  MultiSelectField,
  RequiredMark,
  SettingsCol,
  SettingsRow,
  SettingsSection,
} from "./settingsWidgets";

const SOCIAL_FIELDS = [
  { key: "facebookUrl", label: "Facebook URL", icon: faFacebook },
  { key: "linkedinUrl", label: "LinkedIn URL", icon: faLinkedin },
  { key: "twitterUrl", label: "Twitter/X URL", icon: faXTwitter },
  { key: "youtubeUrl", label: "YouTube URL", icon: faYoutube },
] as const satisfies readonly {
  key: keyof CompanySettings;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
}[];

/**
 * The Settings tab of Company settings — company identity, specialties, social
 * links, the marketing disclaimer, and cross-user listing visibility.
 *
 * Edits live in local state (no persistence), matching the other prototype
 * settings surfaces; Save Changes confirms with a toast.
 */
export function CompanyInfoForm() {
  // Company settings are themselves behind Manage Company.
  const canManage = useCan("manage-company");
  const [form, setForm] = useState<CompanySettings>(COMPANY_SETTINGS);

  // The two contact-ownership ceilings live in a shared store (the permissions
  // page reads them), so they're drafted here and written back on Save with the
  // rest of the form — one Save button, one moment the settings take effect.
  const savedAccess = useContactAccessSettings((s) => s.settings);
  const setSavedAccess = useContactAccessSettings((s) => s.setSettings);
  const [access, setAccess] = useState<ContactAccessSettings>(savedAccess);
  const setAccessField = <K extends keyof ContactAccessSettings>(
    key: K,
    value: ContactAccessSettings[K],
  ) => setAccess((prev) => ({ ...prev, [key]: value }));
  const companyDefault = resolveCompanyDefault(access);

  const set = <K extends keyof CompanySettings>(
    key: K,
    value: CompanySettings[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSave() {
    if (!form.name.trim()) {
      notify({ title: "Company name is required" });
      return;
    }
    setSavedAccess(access);
    notify({
      title: "Company settings saved",
      description: `${form.name} updated.`,
    });
  }

  return (
    <div className="d-flex flex-column">
      <SettingsSection title="Company Information">
        <SettingsRow>
          <SettingsCol>
            <Field>
              <Field.Label>
                Company Name
                <RequiredMark />
              </Field.Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Company Email Address</Field.Label>
              <Input
                type="email"
                value={form.emailAddress}
                onChange={(e) => set("emailAddress", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Salesforce ID</Field.Label>
              <InputGroup>
                <Input
                  value={form.salesforceId}
                  onChange={(e) => set("salesforceId", e.target.value)}
                />
                <InputGroup.Addon>
                  <Tooltip>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="About the Salesforce ID"
                        >
                          <FontAwesomeIcon icon={faCircleInfo} />
                        </Button>
                      }
                    />
                    <Tooltip.Content side="top">
                      Links this company to its Salesforce org for record sync.
                    </Tooltip.Content>
                  </Tooltip>
                </InputGroup.Addon>
              </InputGroup>
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Admin Email Addresses</Field.Label>
              <Input
                value={form.adminEmailAddresses}
                onChange={(e) => set("adminEmailAddresses", e.target.value)}
              />
              <Field.Description>
                Copied on Syndication email updates, if desired.
              </Field.Description>
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Website</Field.Label>
              <Input
                type="url"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </Field>
          </SettingsCol>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Specialties"
        description="How this company is categorized across Buildout's marketplace and search."
      >
        <SettingsRow>
          <SettingsCol>
            <Field>
              <Field.Label>Specialties</Field.Label>
              <MultiSelectField
                options={SPECIALTY_OPTIONS}
                value={form.specialties}
                onChange={(next) => set("specialties", next)}
                emptyMessage="No matching specialties"
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Sub-Specialties</Field.Label>
              <MultiSelectField
                options={SUB_SPECIALTY_OPTIONS}
                value={form.subSpecialties}
                onChange={(next) => set("subSpecialties", next)}
                emptyMessage="No matching sub-specialties"
              />
            </Field>
          </SettingsCol>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Social Media">
        <SettingsRow>
          {SOCIAL_FIELDS.map((social) => (
            <SettingsCol key={social.key}>
              <Field>
                <Field.Label>{social.label}</Field.Label>
                <InputGroup>
                  <InputGroup.Addon>
                    <FontAwesomeIcon icon={social.icon} />
                  </InputGroup.Addon>
                  <Input
                    type="url"
                    value={form[social.key] as string}
                    onChange={(e) => set(social.key, e.target.value)}
                  />
                </InputGroup>
              </Field>
            </SettingsCol>
          ))}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Disclaimer"
        description="Appended to marketing documents and listing websites."
      >
        <Textarea
          rows={6}
          value={form.disclaimer}
          onChange={(e) => set("disclaimer", e.target.value)}
        />
      </SettingsSection>

      <SettingsSection title="Listing Visibility">
        <div className="d-flex flex-column gap-3">
          <Field orientation="horizontal" className="align-items-start gap-2">
            <Checkbox
              checked={form.shareOnMarketListings}
              onCheckedChange={(checked) =>
                set("shareOnMarketListings", checked)
              }
            />
            <div>
              <Field.Label className="mb-0">
                Share &apos;On Market&apos; Listings
              </Field.Label>
              <Field.Description>
                Users can see other users&apos; on-market listings in the index
                and public docs from within the listing view.
              </Field.Description>
            </div>
          </Field>
          <Field orientation="horizontal" className="align-items-start gap-2">
            <Checkbox
              checked={form.shareClosedListings}
              onCheckedChange={(checked) => set("shareClosedListings", checked)}
            />
            <div>
              <Field.Label className="mb-0">
                Share &apos;Closed&apos; Listings
              </Field.Label>
              <Field.Description>
                Users can see other users&apos; closed listings in the index and
                public docs from within the listing view.
              </Field.Description>
            </div>
          </Field>
        </div>
      </SettingsSection>

      {/* The account setting is the ceiling, the user permission is the grant:
          these two decide what the company allows, and Own Contacts / Keep
          Contacts Private on each person's permissions page decide who gets it.
          Sits beside Listing Visibility because it's the same kind of question
          — what one user can see of another's records — asked about contacts. */}
      <SettingsSection
        title="Contact Ownership"
        description="Who owns the contacts brokers bring in, and whether they can be hidden from colleagues. Each person's Own Contacts and Mark Contacts Private permissions apply underneath these."
        divider={false}
      >
        <div className="d-flex flex-column gap-3">
          <Field orientation="horizontal" className="align-items-start gap-2">
            <Checkbox
              checked={access.brokersCanOwnContacts}
              onCheckedChange={(checked) =>
                setAccessField("brokersCanOwnContacts", checked)
              }
            />
            <div className="flex-grow-1">
              <Field.Label className="mb-0">Brokers can own contacts</Field.Label>
              <Field.Description>
                Off: the company owns every contact, anyone can find it, and
                Managing Directors assign contacts to brokers to work them. On:
                brokers with the Own Contacts permission own the contacts they
                create or import.
              </Field.Description>
              {access.brokersCanOwnContacts && (
                <GrantDefaultPicker
                  name="own-default"
                  value={access.ownDefault}
                  onChange={(v) => setAccessField("ownDefault", v)}
                />
              )}
            </div>
          </Field>
          <Field orientation="horizontal" className="align-items-start gap-2">
            {/* Nothing to be private about when the company owns everything,
                so this one locks (and stops counting) while the first is off. */}
            <Checkbox
              checked={access.ownedContactsCanBePrivate}
              disabled={!access.brokersCanOwnContacts}
              onCheckedChange={(checked) =>
                setAccessField("ownedContactsCanBePrivate", checked)
              }
            />
            <div
              className={`flex-grow-1 ${
                access.brokersCanOwnContacts ? "" : "text-muted"
              }`}
            >
              <Field.Label className="mb-0">
                Broker-owned contacts can be private
              </Field.Label>
              <Field.Description>
                Off: everything a broker owns stays visible across the firm.
                On: brokers with the Mark Contacts Private permission can hide a
                contact — search included — until they share it.
              </Field.Description>
              {access.brokersCanOwnContacts &&
                access.ownedContactsCanBePrivate && (
                  <GrantDefaultPicker
                    name="private-default"
                    value={access.privateDefault}
                    onChange={(v) => setAccessField("privateDefault", v)}
                  />
                )}
            </div>
          </Field>

          {/* What the switches and their defaults mean for a Broker with no
              overrides — the trickle-down is the point of the model, and it's
              easier to read here than to infer. */}
          <div className="rounded bg-storm-grey-50 px-3 py-2">
            <span className="fw-semibold">{companyDefault.title}.</span>{" "}
            <span className="text-muted">{companyDefault.summary}</span>
          </div>
        </div>
      </SettingsSection>

      {canManage ? (
        <div className="d-flex justify-content-end mt-5">
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      ) : (
        <div className="mt-5">
          <ManageCompanyNotice what="change company settings" />
        </div>
      )}
    </div>
  );
}

/**
 * Who a switch's grant reaches by default. "Every Broker" is the philosophy
 * reading (a broker-book shop); "only people you grant it to" is the privilege
 * reading (an open database with a protected rainmaker or two). The company
 * decides its posture here, where it decides the ceiling, so roles stay fixed
 * and exceptions are still per-person overrides on the permissions page.
 */
function GrantDefaultPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: GrantDefault;
  onChange: (next: GrantDefault) => void;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as GrantDefault)}
      className="d-flex flex-wrap gap-3 mt-2"
      aria-label="Who gets this by default"
    >
      {(Object.keys(GRANT_DEFAULT_LABELS) as GrantDefault[]).map((option) => (
        // The radio renders as a non-labelable element, so `htmlFor` doesn't
        // reach it; the label selects explicitly instead so its text is a
        // target too, not just the 16px control.
        <label
          key={option}
          className="d-flex align-items-center gap-2 mb-0 fs-small"
          style={{ cursor: "pointer" }}
          onClick={() => onChange(option)}
        >
          <RadioGroup.Item
            value={option}
            id={`${name}-${option}`}
            aria-label={GRANT_DEFAULT_LABELS[option]}
          />
          {GRANT_DEFAULT_LABELS[option]}
        </label>
      ))}
    </RadioGroup>
  );
}
