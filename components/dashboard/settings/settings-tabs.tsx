"use client";

import { PasswordForm } from "@/components/dashboard/settings/password-form";
import { WorkRules } from "@/components/dashboard/settings/work-rules";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SettingsTabsProps } from "@/types/settings";

export function SettingsTabs({ workRules, tab }: SettingsTabsProps) {
  return (
    <Tabs defaultValue={tab} className="w-full max-w-[560px] gap-4">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        {workRules && <TabsTrigger value="work-rules">Work rules</TabsTrigger>}
      </TabsList>
      <TabsContent value="account">
        <PasswordForm />
      </TabsContent>
      {workRules && (
        <TabsContent value="work-rules">
          <WorkRules {...workRules} />
        </TabsContent>
      )}
    </Tabs>
  );
}
