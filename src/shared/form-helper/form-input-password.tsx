"use client"

import type * as React from "react"
import type { Control, FieldPath, FieldValues } from "react-hook-form"

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form"
import { InputPassword } from "@/shared/ui/input-password"

type FormInputPasswordProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label?: React.ReactNode
  description?: React.ReactNode
} & Omit<
  React.ComponentProps<typeof InputPassword>,
  "name" | "value" | "defaultValue" | "onChange" | "onBlur"
>

function FormInputPassword<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...inputProps
}: FormInputPasswordProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <InputPassword
              {...inputProps}
              {...field}
              value={field.value ?? ""}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export { FormInputPassword, type FormInputPasswordProps }
