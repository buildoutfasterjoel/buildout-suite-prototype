import { useState } from "react";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpFromBracket,
  faKey,
  faPlus,
  faTrashCan,
} from "@fortawesome/pro-regular-svg-icons";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import {
  faFacebook,
  faInstagram,
  faLinkedin,
  faXTwitter,
} from "@fortawesome/free-brands-svg-icons";
import { OFFICES, type RosterUser } from "#/data/roster";
import {
  COUNTRY_OPTIONS,
  DESIGNATION_OPTIONS,
  HOMEPAGE_ROUTES,
  ORGANIZATION_OPTIONS,
  STATE_OPTIONS,
  seedProfile,
  type HomepageRoute,
  type UserProfile,
} from "#/data/userProfile";
import {
  SPECIALTY_OPTIONS,
  SUB_SPECIALTY_OPTIONS,
} from "#/data/companySettings";
import { notify } from "#/lib/notify";
import { ManageCompanyNotice } from "./ManageCompanyNotice";
import { useCan } from "./useViewer";
import {
  MultiSelectField,
  RequiredMark,
  SettingsCol,
  SettingsRow,
  SettingsSection,
} from "#/components/settings/settingsWidgets";
import { useRoster } from "./useRoster";

const SOCIAL_FIELDS = [
  { key: "facebookUrl", label: "Facebook URL", icon: faFacebook },
  { key: "twitterUrl", label: "X (Twitter) URL", icon: faXTwitter },
  { key: "linkedinUrl", label: "LinkedIn URL", icon: faLinkedin },
  { key: "instagramUrl", label: "Instagram URL", icon: faInstagram },
] as const;

/** A multi-select paired with its "Show on Broker Plugin" switch. */
function PluginListField({
  label,
  options,
  value,
  onChange,
  shown,
  onShownChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  shown: boolean;
  onShownChange: (next: boolean) => void;
}) {
  return (
    <div className="d-flex flex-column gap-2">
      <Field>
        <Field.Label>{label}</Field.Label>
        <MultiSelectField
          options={options}
          value={value}
          onChange={onChange}
          emptyMessage={`No matching ${label.toLowerCase()}`}
        />
      </Field>
      <Field orientation="horizontal" className="align-items-center gap-2">
        <Switch checked={shown} onCheckedChange={onShownChange} />
        <Field.Label className="mb-0">Show on Broker Plugin</Field.Label>
      </Field>
    </div>
  );
}

/**
 * The Profile tab of a user's page.
 *
 * Carries the fields Buildout's Profile Settings page has today, read as an
 * admin editing a teammate rather than someone editing themselves — so the
 * password and MFA controls are replaced by a reset the admin can trigger,
 * and deactivation is available (it isn't on your own account).
 *
 * Identity fields write back to the roster on save so the header above and the
 * Users table stay in step; the rest is session-local, like the other
 * prototype settings screens.
 */
export function UserProfileForm({ user }: { user: RosterUser }) {
  const setIdentity = useRoster((s) => s.setIdentity);
  // Your own profile is always yours to edit. Someone else's takes Manage
  // Company, and without it there's nothing here worth showing — a teammate's
  // contact details aren't this page's job.
  const canManage = useCan("manage-company");
  const [form, setForm] = useState<UserProfile>(() => seedProfile(user));

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      notify({ title: "First and last name are required" });
      return;
    }
    if (!form.phone.trim()) {
      notify({ title: "Phone number is required" });
      return;
    }
    setIdentity(user.id, {
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
      email: form.email,
      title: form.jobTitle,
      office: form.primaryOffice,
    });
    notify({
      title: "Profile saved",
      description: `${form.firstName}'s profile has been updated.`,
    });
  }

  if (!canManage && !user.isYou) {
    return (
      <ManageCompanyNotice what={`view ${form.firstName}'s profile`} />
    );
  }

  return (
    <div className="d-flex flex-column">
      <SettingsSection title="Login Information">
        <SettingsRow>
          <SettingsCol>
            <Field>
              <Field.Label>Login</Field.Label>
              <Input
                value={form.login}
                onChange={(e) => set("login", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Email</Field.Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
          </SettingsCol>
        </SettingsRow>

        {/* Password and MFA are the person's to set, not an admin's — so this
            view offers a reset instead of the fields themselves. */}
        <Alert severity="info" withIcon>
          <FontAwesomeIcon icon={faCircleInfo} />
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap w-100">
            <span>
              Passwords and multi-factor enrollment belong to {form.firstName}.
              You can send a reset link instead.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={() =>
                notify({
                  title: "Reset link sent",
                  description: `${form.email} can set a new password.`,
                })
              }
            >
              <FontAwesomeIcon icon={faKey} />
              Send password reset
            </Button>
          </div>
        </Alert>
      </SettingsSection>

      <SettingsSection title="Profile Information">
        <SettingsRow>
          <SettingsCol>
            <Field>
              <Field.Label>
                First Name
                <RequiredMark />
              </Field.Label>
              <Input
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>
                Last Name
                <RequiredMark />
              </Field.Label>
              <Input
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>
                Phone Number
                <RequiredMark />
              </Field.Label>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Phone Extension</Field.Label>
              <Input
                value={form.phoneExtension}
                onChange={(e) => set("phoneExtension", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Cell Phone</Field.Label>
              <Input
                value={form.cellPhone}
                onChange={(e) => set("cellPhone", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Fax</Field.Label>
              <Input
                value={form.fax}
                onChange={(e) => set("fax", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>
                Country
                <RequiredMark />
              </Field.Label>
              <Select
                value={form.country}
                onValueChange={(v) => v && set("country", v as string)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {COUNTRY_OPTIONS.map((c) => (
                    <Select.Item key={c} value={c}>
                      {c}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>State</Field.Label>
              <Select
                value={form.state}
                onValueChange={(v) => v && set("state", v as string)}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select..." />
                </Select.Trigger>
                <Select.Content>
                  {STATE_OPTIONS.map((s) => (
                    <Select.Item key={s} value={s}>
                      {s}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>City</Field.Label>
              <Input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Zip</Field.Label>
              <Input
                value={form.zip}
                onChange={(e) => set("zip", e.target.value)}
              />
            </Field>
          </SettingsCol>
        </SettingsRow>

        <div className="d-flex flex-column gap-2">
          <Field orientation="horizontal" className="align-items-center gap-2">
            <Switch
              checked={form.showVcard}
              onCheckedChange={(v) => set("showVcard", v)}
            />
            <Field.Label className="mb-0">
              Show vcard on Broker Plugin
            </Field.Label>
          </Field>
          <Field orientation="horizontal" className="align-items-center gap-2">
            <Switch
              checked={form.showPrintButton}
              onCheckedChange={(v) => set("showPrintButton", v)}
            />
            <Field.Label className="mb-0">
              Show print button for broker bio
            </Field.Label>
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Expertise"
        description="Designations, practice areas, and memberships shown on the broker plugin."
      >
        <SettingsRow>
          <SettingsCol>
            <PluginListField
              label="Designations"
              options={DESIGNATION_OPTIONS}
              value={form.designations}
              onChange={(v) => set("designations", v)}
              shown={form.showDesignations}
              onShownChange={(v) => set("showDesignations", v)}
            />
          </SettingsCol>
          <SettingsCol>
            <PluginListField
              label="Organizations"
              options={ORGANIZATION_OPTIONS}
              value={form.organizations}
              onChange={(v) => set("organizations", v)}
              shown={form.showOrganizations}
              onShownChange={(v) => set("showOrganizations", v)}
            />
          </SettingsCol>
          <SettingsCol>
            <PluginListField
              label="Specialties"
              options={SPECIALTY_OPTIONS}
              value={form.specialties}
              onChange={(v) => set("specialties", v)}
              shown={form.showSpecialties}
              onShownChange={(v) => set("showSpecialties", v)}
            />
          </SettingsCol>
          <SettingsCol>
            <PluginListField
              label="Sub-Specialties"
              options={SUB_SPECIALTY_OPTIONS}
              value={form.subSpecialties}
              onChange={(v) => set("subSpecialties", v)}
              shown={form.showSubSpecialties}
              onShownChange={(v) => set("showSubSpecialties", v)}
            />
          </SettingsCol>
        </SettingsRow>
      </SettingsSection>

      {/* The per-user landing page. Worth noting against the deferred
          role-driven homepage: today this is a manual per-user choice, and a
          role's common workflows are exactly what would pick it automatically. */}
      <SettingsSection
        title="Homepage Settings"
        description="Where this user lands after signing in to Buildout."
      >
        <RadioGroup
          value={form.homepageRoute}
          onValueChange={(v) => set("homepageRoute", v as HomepageRoute)}
          className="d-flex flex-column gap-2"
        >
          {HOMEPAGE_ROUTES.map((route) => (
            <label
              key={route.value}
              className="d-flex align-items-start gap-2"
              style={{ cursor: "pointer" }}
            >
              <RadioGroup.Item value={route.value} className="mt-1" />
              <span>
                <span className="fw-semibold">{route.label}</span>
                <span className="text-muted d-block small">{route.hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </SettingsSection>

      <SettingsSection title="Company and Title">
        <SettingsRow>
          <SettingsCol>
            <Field>
              <Field.Label>Primary Company Office</Field.Label>
              <Select
                value={form.primaryOffice}
                onValueChange={(v) => v && set("primaryOffice", v as string)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {OFFICES.map((office) => (
                    <Select.Item key={office} value={office}>
                      {office}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>
                Secondary Company Offices (for Broker Plugin)
              </Field.Label>
              <MultiSelectField
                options={OFFICES.filter((o) => o !== form.primaryOffice)}
                value={form.secondaryOffices}
                onChange={(v) => set("secondaryOffices", v)}
                placeholder="Select one or more"
                emptyMessage="No other offices"
              />
            </Field>
          </SettingsCol>
          <SettingsCol>
            <Field>
              <Field.Label>Job Title</Field.Label>
              <Input
                value={form.jobTitle}
                onChange={(e) => set("jobTitle", e.target.value)}
              />
              <Field.Description>
                Shown on the roster and in the header above.
              </Field.Description>
            </Field>
          </SettingsCol>
        </SettingsRow>

        <Field orientation="horizontal" className="align-items-center gap-2">
          <Switch
            checked={form.hideTitleOnPlugin}
            onCheckedChange={(v) => set("hideTitleOnPlugin", v)}
          />
          <Field.Label className="mb-0">Hide on Broker Plugin</Field.Label>
        </Field>
      </SettingsSection>

      <SettingsSection
        title="Licenses"
        description="Real estate licenses held, by state."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              notify({
                title: "Add license",
                description: "License records aren't wired up in this prototype.",
              })
            }
          >
            <FontAwesomeIcon icon={faPlus} />
            Add license
          </Button>
        }
      >
        <p className="text-muted mb-0">No licenses on file.</p>
      </SettingsSection>

      <SettingsSection title="Biography">
        <Textarea
          rows={5}
          placeholder={`A short bio for ${form.firstName}, used on documents and the broker plugin.`}
          value={form.biography}
          onChange={(e) => set("biography", e.target.value)}
        />
      </SettingsSection>

      <SettingsSection title="Social">
        <SettingsRow>
          {SOCIAL_FIELDS.map((social) => (
            <SettingsCol key={social.key}>
              <Field>
                <Field.Label className="d-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={social.icon} />
                  {social.label}
                </Field.Label>
                <Input
                  type="url"
                  value={form[social.key]}
                  onChange={(e) => set(social.key, e.target.value)}
                />
              </Field>
            </SettingsCol>
          ))}
          <SettingsCol>
            <Field>
              <Field.Label>Broker Profile URL</Field.Label>
              <Input
                type="url"
                value={form.brokerProfileUrl}
                onChange={(e) => set("brokerProfileUrl", e.target.value)}
              />
            </Field>
          </SettingsCol>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Profile Image">
        <div className="d-flex align-items-center gap-4 flex-wrap">
          <Avatar style={{ width: 96, height: 96, borderRadius: 4 }}>
            {user.avatarUrl && <Avatar.Image src={user.avatarUrl} alt="" />}
            <Avatar.Fallback>{user.initials}</Avatar.Fallback>
          </Avatar>
          <div className="d-flex flex-column gap-2">
            <Button variant="outline" size="sm">
              <FontAwesomeIcon icon={faArrowUpFromBracket} />
              Replace photo
            </Button>
            <Button variant="ghost" size="sm" className="text-danger">
              <FontAwesomeIcon icon={faTrashCan} />
              Remove
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Other Settings" divider={false}>
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap border rounded p-3">
          <div>
            <div className="fw-semibold">
              {user.status === "active" ? "Deactivate" : "Reactivate"} this
              account
            </div>
            <div className="text-muted small">
              {user.isYou
                ? "You can't deactivate your own account."
                : user.status === "active"
                  ? "They keep their records, but can no longer sign in."
                  : "They'll be able to sign in again."}
            </div>
          </div>
          <Button
            variant="outline"
            disabled={user.isYou}
            className={user.status === "active" ? "text-danger" : undefined}
            onClick={() =>
              notify({
                title: `${user.status === "active" ? "Deactivate" : "Reactivate"} user`,
                description: "Not wired up in this prototype.",
              })
            }
          >
            {user.status === "active" ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </SettingsSection>

      <div className="d-flex justify-content-end gap-2 mt-5">
        <Button variant="outline" onClick={() => setForm(seedProfile(user))}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Profile
        </Button>
      </div>
    </div>
  );
}
