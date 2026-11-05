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
import { Textarea } from "@/shared/ui/textarea"

type FormTextareaProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label?: React.ReactNode
  description?: React.ReactNode
  /** Classes for the textarea itself (className styles the wrapper). */
  textareaClassName?: string
} & Omit<
  React.ComponentProps<typeof Textarea>,
  "name" | "value" | "defaultValue" | "onChange" | "onBlur"
>

function FormTextarea<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  textareaClassName,
  ...textareaProps
}: FormTextareaProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Textarea
              {...textareaProps}
              {...field}
              value={field.value ?? ""}
              className={textareaClassName}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export { FormTextarea, type FormTextareaProps }
