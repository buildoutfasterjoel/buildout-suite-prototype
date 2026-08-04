import { createFileRoute } from "@tanstack/react-router";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo, faPaintbrush } from "@fortawesome/pro-regular-svg-icons";
import { CompanyInfoForm } from "#/components/settings/CompanyInfoForm";
import { CompanyStylesForm } from "#/components/settings/CompanyStylesForm";

export const Route = createFileRoute("/_shell/settings/company")({
  component: CompanySettingsPage,
});

function CompanySettingsPage() {
  return (
    <div className="p-4">
      <Tabs defaultValue="settings">
        <Tabs.List>
          <Tabs.Tab
            value="settings"
            icon={<FontAwesomeIcon icon={faCircleInfo} />}
          >
            Settings
          </Tabs.Tab>
          <Tabs.Tab
            value="styles"
            icon={<FontAwesomeIcon icon={faPaintbrush} />}
          >
            Styles
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Content>
          <Tabs.Panel value="settings" className="pt-4">
            <CompanyInfoForm />
          </Tabs.Panel>
          <Tabs.Panel value="styles" className="pt-4">
            <CompanyStylesForm />
          </Tabs.Panel>
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
