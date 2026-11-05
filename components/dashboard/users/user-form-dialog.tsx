"use client";

import { useForm, type StandardSchemaV1 } from "@tanstack/react-form";
import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { nameFieldError } from "@/app/dashboard/locations/location-rules";
import { createUser, updateUser } from "@/app/dashboard/users/actions";
import { assignableRoles } from "@/app/dashboard/users/user-access";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppRole } from "@/types/roles";
import type { UserFormDialogProps } from "@/types/users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { createUserSchema, updateUserSchema, type UpdateUserInput } from "@/validation/users";

const ROLES: readonly string[] = Object.keys(ROLE_LABELS);

function isAppRole(role: string | null | undefined): role is AppRole {
  return role != null && ROLES.includes(role);
}

// The only role the actor can assign is fixed, so the form starts on it (HO assigns admin_site). When the actor
// has a choice, the form starts on the user's own role if it is assignable, and otherwise empty so the user must
// pick one. It never preselects a role, which would let a save grant superadmin by default.
function defaultRole(role: string | null | undefined, roles: AppRole[]): AppRole | "" {
  if (roles.length === 1) {
    return roles[0];
  }

  return isAppRole(role) && roles.includes(role) ? role : "";
}

export function UserFormDialog({
  user,
  access,
  choices,
  open,
  onOpenChange,
}: UserFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const roles = assignableRoles(access);
  const hasRoleChoice = roles.length > 1;
  const initialRole = defaultRole(user?.role, roles);

  // The site only narrows the location list, so it lives outside the form values. HO has one site, and
  // superadmin starts on the site of the user's current location when editing.
  const [locationSiteId, setLocationSiteId] = useState(() => {
    if (access.role === "ho") {
      return choices.sites[0]?.id ?? "";
    }

    return (
      choices.locations.find((location) => location.id === user?.locationId)
        ?.siteId ?? ""
    );
  });

  // The form uses the update shape, where password is optional, so one form type fits both schemas.
  const defaultValues: UpdateUserInput = {
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    // The empty role is deliberate and fails the schema's "Choose a role" check on submit.
    role: initialRole as AppRole,
    siteId: initialRole === "ho" ? (user?.siteId ?? null) : null,
    locationId: initialRole === "admin_site" ? (user?.locationId ?? null) : null,
  };

  // The two schemas differ only in password, so the ternary's union type is narrowed to the form's shape.
  const schema: StandardSchemaV1<UpdateUserInput> = user ? updateUserSchema : createUserSchema;

  const form = useForm({
    defaultValues,
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);

      const scoped = {
        name: value.name,
        email: value.email,
        role: value.role,
        siteId: value.role === "ho" ? value.siteId : null,
        locationId: value.role === "admin_site" ? value.locationId : null,
      };

      const result = user
        ? await updateUser(user.id, {
            ...scoped,
            password: value.password === "" ? undefined : value.password,
          })
        : await createUser({ ...scoped, password: value.password ?? "" });

      if (!result.ok) {
        setFormError(result.formError ?? null);
        formApi.setErrorMap({
          onSubmit: {
            form: result.formError,
            fields: {
              name: nameFieldError(result.fieldErrors?.name),
              email: nameFieldError(result.fieldErrors?.email),
              password: nameFieldError(result.fieldErrors?.password),
              role: nameFieldError(result.fieldErrors?.role),
              siteId: nameFieldError(result.fieldErrors?.siteId),
              locationId: nameFieldError(result.fieldErrors?.locationId),
            },
          },
        });
        return;
      }

      toast.success(user ? "User updated" : "User created");
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
          </DialogHeader>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <>
                <FieldGroup>
                  <form.Field name="name">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoFocus
                            disabled={isSubmitting}
                            aria-invalid={isInvalid || undefined}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Field name="email">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="email"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            disabled={isSubmitting}
                            aria-invalid={isInvalid || undefined}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Field name="password">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                          <InputGroup>
                            <InputGroupInput
                              id={field.name}
                              name={field.name}
                              type={showPassword ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder={
                                user ? "Leave blank to keep the current password" : undefined
                              }
                              value={field.state.value ?? ""}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              disabled={isSubmitting}
                              aria-invalid={isInvalid || undefined}
                            />
                            <InputGroupAddon align="inline-end">
                              <InputGroupButton
                                type="button"
                                size="icon-xs"
                                aria-label={
                                  showPassword ? "Hide password" : "Show password"
                                }
                                aria-pressed={showPassword}
                                disabled={isSubmitting}
                                onClick={() => setShowPassword((current) => !current)}
                              >
                                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                              </InputGroupButton>
                            </InputGroupAddon>
                          </InputGroup>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Field name="role">
                    {(field) => {
                      if (!hasRoleChoice) {
                        return (
                          <Field>
                            <FieldLabel>Role</FieldLabel>
                            <p className="text-sm">{ROLE_LABELS[roles[0]]}</p>
                          </Field>
                        );
                      }

                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Role</FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) => {
                              if (!isAppRole(value)) {
                                return;
                              }

                              field.handleChange(value);
                              form.setFieldValue("siteId", null);
                              form.setFieldValue("locationId", null);
                              setLocationSiteId("");
                            }}
                            items={roles.map((role) => ({
                              value: role,
                              label: ROLE_LABELS[role],
                            }))}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger
                              id={field.name}
                              aria-invalid={isInvalid || undefined}
                              className="w-full"
                            >
                              <SelectValue placeholder="Choose a role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {roles.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {ROLE_LABELS[role]}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Subscribe selector={(state) => state.values.role}>
                    {(role) => (
                      <>
                        {access.role === "superadmin" && role === "ho" && (
                          <form.Field name="siteId">
                            {(field) => {
                              const isInvalid = field.state.meta.errors.length > 0;

                              return (
                                <Field data-invalid={isInvalid || undefined}>
                                  <FieldLabel htmlFor={field.name}>Site</FieldLabel>
                                  <Select
                                    value={field.state.value}
                                    onValueChange={(value) => {
                                      if (value) {
                                        field.handleChange(value);
                                      }
                                    }}
                                    items={choices.sites.map((site) => ({
                                      value: site.id,
                                      label: site.name,
                                    }))}
                                    disabled={isSubmitting}
                                  >
                                    <SelectTrigger
                                      id={field.name}
                                      aria-invalid={isInvalid || undefined}
                                      className="w-full"
                                    >
                                      <SelectValue placeholder="Choose a site" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        {choices.sites.map((site) => (
                                          <SelectItem key={site.id} value={site.id}>
                                            {site.name}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  {isInvalid && (
                                    <FieldError errors={field.state.meta.errors} />
                                  )}
                                </Field>
                              );
                            }}
                          </form.Field>
                        )}
                        {access.role === "ho" && choices.sites[0] && (
                          <Field>
                            <FieldLabel>Site</FieldLabel>
                            <p className="text-sm">{choices.sites[0].name}</p>
                          </Field>
                        )}
                        {access.role === "superadmin" && role === "admin_site" && (
                          <Field>
                            <FieldLabel htmlFor="location-site">Site</FieldLabel>
                            <Select
                              value={locationSiteId}
                              onValueChange={(value) => {
                                if (value && value !== locationSiteId) {
                                  setLocationSiteId(value);
                                  form.setFieldValue("locationId", null);
                                }
                              }}
                              items={choices.sites.map((site) => ({
                                value: site.id,
                                label: site.name,
                              }))}
                              disabled={isSubmitting}
                            >
                              <SelectTrigger id="location-site" className="w-full">
                                <SelectValue placeholder="Choose a site" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {choices.sites.map((site) => (
                                    <SelectItem key={site.id} value={site.id}>
                                      {site.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                        {role === "admin_site" && (
                          <form.Field name="locationId">
                            {(field) => {
                              const isInvalid = field.state.meta.errors.length > 0;
                              const siteLocations = choices.locations.filter(
                                (location) => location.siteId === locationSiteId,
                              );

                              return (
                                <Field data-invalid={isInvalid || undefined}>
                                  <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                                  <Select
                                    value={field.state.value}
                                    onValueChange={(value) => {
                                      if (value) {
                                        field.handleChange(value);
                                      }
                                    }}
                                    items={siteLocations.map((location) => ({
                                      value: location.id,
                                      label: location.name,
                                    }))}
                                    disabled={isSubmitting || locationSiteId === ""}
                                  >
                                    <SelectTrigger
                                      id={field.name}
                                      aria-invalid={isInvalid || undefined}
                                      className="w-full"
                                    >
                                      <SelectValue
                                        placeholder={
                                          locationSiteId === ""
                                            ? "Choose a site first"
                                            : "Choose a location"
                                        }
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        {siteLocations.map((location) => (
                                          <SelectItem
                                            key={location.id}
                                            value={location.id}
                                          >
                                            {location.name}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  {isInvalid && (
                                    <FieldError errors={field.state.meta.errors} />
                                  )}
                                </Field>
                              );
                            }}
                          </form.Field>
                        )}
                      </>
                    )}
                  </form.Subscribe>
                </FieldGroup>
                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}
                <DialogFooter>
                  <DialogClose
                    render={<Button variant="outline" disabled={isSubmitting} />}
                  >
                    Cancel
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Spinner data-icon="inline-start" />}
                    Save
                  </Button>
                </DialogFooter>
              </>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
