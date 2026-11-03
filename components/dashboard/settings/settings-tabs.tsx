"use client";

import { useState } from "react";
import { PasswordForm } from "@/components/dashboard/settings/password-form";
import { WorkRules } from "@/components/dashboard/settings/work-rules";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SettingsTab, SettingsTabsProps } from "@/types/settings";

// Controlled, because the starting tab comes from ?tab= and that prop changes after the first
// render when a level change adds it to the URL.
export function SettingsTabs({ workRules, tab }: SettingsTabsProps) {
  const [value, setValue] = useState<SettingsTab>(tab);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => setValue(next as SettingsTab)}
      className="w-full max-w-140 gap-4"
    >
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
