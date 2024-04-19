import { z } from "zod";

// sanity checked schemas for common types
export const NonNegativeSafeInteger = z.number().int().safe().nonnegative();
export const PositiveSafeInteger = z.number().int().safe().positive();
export const ZSaneString = z.string().trim().min(1).max(500);
export const ZSaneLongString = z.string().trim().min(1).max(10000);
export const ZSaneEmail = z.string().email().max(500);
export const ZSaneQuantity = z.number().int().positive();
export const ZSaneDate = z.coerce.date().min(new Date("2010-01-01"));
export const ZSaneIdentifier = z
  .string()
  .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/i)
  .max(100);
export const ZSaneAlphanum = z
  .string()
  .regex(/^[0-9a-z]+$/i)
  .max(100);
export const ZLocalizableString = z.union([ZSaneString, z.record(ZSaneString)]);
